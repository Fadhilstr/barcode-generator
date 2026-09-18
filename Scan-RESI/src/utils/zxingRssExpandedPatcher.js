
/**
 * zxingRssExpandedPatcher.js
 * Runtime patcher transparan untuk memperbaiki cacat bawaan translasi Java -> JavaScript
 * pada pustaka @zxing/library untuk format GS1 DataBar Expanded (RSS Expanded).
 */

import {
  ZXingSystem,
  RSSExpandedReader,
  AbstractExpandedDecoder,
  BitArray,
  MathUtils,
  NotFoundException,
  ZXingStringBuilder,
  createAbstractExpandedDecoder
} from '@zxing/library'

import RSSUtils from '@zxing/library/esm/core/oned/rss/RSSUtils.js'
import DataCharacter from '@zxing/library/esm/core/oned/rss/DataCharacter.js'
import ExpandedRow from '@zxing/library/esm/core/oned/rss/expanded/ExpandedRow.js'
import CurrentParsingState from '@zxing/library/esm/core/oned/rss/expanded/decoders/CurrentParsingState.js'

let isPatched = false

/**
 * Menerapkan seluruh runtime patch ke prototype ZXing.
 * Bersifat idempotent (aman dipanggil berulang kali).
 */
export function applyZxingRssExpandedPatch() {
  if (isPatched) return true
  if (typeof window !== 'undefined' && window.__zxing_rss_expanded_patched__) {
    isPatched = true
    return true
  }

  try {
    // -------------------------------------------------------------------------
    // Cacat 1: ZXingSystem.arraycopy
    // Menangani in-place forward shift (destPos > srcPos && src === dest)
    // dengan copy ke arah mundur agar elemen array tidak tertimpa seragam.
    // -------------------------------------------------------------------------
    const origArrayCopy = ZXingSystem.arraycopy
    ZXingSystem.arraycopy = function (src, srcPos, dest, destPos, length) {
      if (src === dest && destPos > srcPos) {
        for (let i = length - 1; i >= 0; i--) {
          dest[destPos + i] = src[srcPos + i]
        }
      } else {
        for (let i = 0; i < length; i++) {
          dest[destPos + i] = src[srcPos + i]
        }
      }
    }

    // -------------------------------------------------------------------------
    // Cacat 2: Pembulatan & Indeks Desimal pada decodeDataCharacter
    // - Math.floor(value + 0.5) untuk jumlah modul
    // - (i / 2) | 0 untuk indeks slot array oddCounts & evenCounts
    // - Math.floor((13 - oddSum) / 2) untuk indeks group SYMBOL_WIDEST
    // -------------------------------------------------------------------------
    RSSExpandedReader.prototype.decodeDataCharacter = function (
      row,
      pattern,
      isOddPattern,
      leftChar
    ) {
      const counters = this.getDataCharacterCounters()
      for (let x = 0; x < counters.length; x++) {
        counters[x] = 0
      }
      if (leftChar) {
        RSSExpandedReader.recordPatternInReverse(row, pattern.getStartEnd()[0], counters)
      } else {
        RSSExpandedReader.recordPattern(row, pattern.getStartEnd()[1], counters)
        for (let i = 0, j = counters.length - 1; i < j; i++, j--) {
          const temp = counters[i]
          counters[i] = counters[j]
          counters[j] = temp
        }
      }

      const numModules = 17
      const elementWidth = MathUtils.sum(new Int32Array(counters)) / numModules
      const expectedElementWidth = (pattern.getStartEnd()[1] - pattern.getStartEnd()[0]) / 15.0
      if (Math.abs(elementWidth - expectedElementWidth) / expectedElementWidth > 0.3) {
        throw new NotFoundException()
      }

      const oddCounts = this.getOddCounts()
      const evenCounts = this.getEvenCounts()
      const oddRoundingErrors = this.getOddRoundingErrors()
      const evenRoundingErrors = this.getEvenRoundingErrors()

      for (let i = 0; i < counters.length; i++) {
        const value_1 = (1.0 * counters[i]) / elementWidth
        let count = Math.floor(value_1 + 0.5)
        if (count < 1) {
          if (value_1 < 0.3) {
            throw new NotFoundException()
          }
          count = 1
        } else if (count > 8) {
          if (value_1 > 8.7) {
            throw new NotFoundException()
          }
          count = 8
        }
        const offset = (i / 2) | 0
        if ((i & 0x01) === 0) {
          oddCounts[offset] = count
          oddRoundingErrors[offset] = value_1 - count
        } else {
          evenCounts[offset] = count
          evenRoundingErrors[offset] = value_1 - count
        }
      }

      this.adjustOddEvenCounts(numModules)
      const weightRowNumber =
        4 * pattern.getValue() + (isOddPattern ? 0 : 2) + (leftChar ? 0 : 1) - 1
      let oddChecksumPortion = 0
      let oddSum = 0
      for (let i = oddCounts.length - 1; i >= 0; i--) {
        if (RSSExpandedReader.isNotA1left(pattern, isOddPattern, leftChar)) {
          const weight = RSSExpandedReader.WEIGHTS[weightRowNumber][2 * i]
          oddChecksumPortion += oddCounts[i] * weight
        }
        oddSum += oddCounts[i]
      }

      let evenChecksumPortion = 0
      for (let i = evenCounts.length - 1; i >= 0; i--) {
        if (RSSExpandedReader.isNotA1left(pattern, isOddPattern, leftChar)) {
          const weight = RSSExpandedReader.WEIGHTS[weightRowNumber][2 * i + 1]
          evenChecksumPortion += evenCounts[i] * weight
        }
      }

      const checksumPortion = oddChecksumPortion + evenChecksumPortion
      if ((oddSum & 0x01) !== 0 || oddSum > 13 || oddSum < 4) {
        throw new NotFoundException()
      }

      const group = Math.floor((13 - oddSum) / 2)
      const oddWidest = RSSExpandedReader.SYMBOL_WIDEST[group]
      const evenWidest = 9 - oddWidest
      const vOdd = RSSUtils.getRSSvalue(oddCounts, oddWidest, true)
      const vEven = RSSUtils.getRSSvalue(evenCounts, evenWidest, false)
      const tEven = RSSExpandedReader.EVEN_TOTAL_SUBSET[group]
      const gSum = RSSExpandedReader.GSUM[group]
      const value = vOdd * tEven + vEven + gSum

      return new DataCharacter(value, checksumPortion)
    }

    // -------------------------------------------------------------------------
    // Cacat 3: Array Traversal Java vs JavaScript pada checkChecksum
    // -------------------------------------------------------------------------
    RSSExpandedReader.prototype.checkChecksum = function () {
      if (!this.pairs || !this.pairs.length) return false
      const firstPair = this.pairs[0]
      if (!firstPair) return false
      const checkCharacter = firstPair.getLeftChar()
      const firstCharacter = firstPair.getRightChar()
      if (firstCharacter === null) {
        return false
      }
      let checksum = firstCharacter.getChecksumPortion()
      let s = 2
      for (let i = 1; i < this.pairs.length; ++i) {
        const currentPair = this.pairs[i]
        if (!currentPair || !currentPair.getLeftChar()) continue
        checksum += currentPair.getLeftChar().getChecksumPortion()
        s++
        const currentRightChar = currentPair.getRightChar()
        if (currentRightChar != null) {
          checksum += currentRightChar.getChecksumPortion()
          s++
        }
      }
      checksum %= 211
      const checkCharacterValue = 211 * (s - 4) + checksum
      return checkCharacterValue === checkCharacter.getValue()
    }

    // -------------------------------------------------------------------------
    // Cacat 4: State Decoder Tidak Terinisialisasi di GeneralAppIdDecoder
    // -------------------------------------------------------------------------
    const dummy = new AbstractExpandedDecoder(new BitArray(10))
    const GeneralAppIdDecoderProto = Object.getPrototypeOf(dummy.getGeneralDecoder())
    const origDecodeGeneralPurposeField = GeneralAppIdDecoderProto.decodeGeneralPurposeField

    GeneralAppIdDecoderProto.decodeGeneralPurposeField = function (pos, remaining) {
      if (!this.current) {
        this.current = new CurrentParsingState()
      }
      return origDecodeGeneralPurposeField.call(this, pos, remaining)
    }

    // -------------------------------------------------------------------------
    // Cacat 5: StringBuilder.append menerima number -> harus jadi string digit
    // -------------------------------------------------------------------------
    const origStringBuilderAppend = ZXingStringBuilder.prototype.append
    ZXingStringBuilder.prototype.append = function (s) {
      if (typeof s === 'number') {
        this.value += s.toString()
        return this
      }
      return origStringBuilderAppend.call(this, s)
    }

    // -------------------------------------------------------------------------
    // Cacat 6: GeneralAppIdDecoder.decodeAlphanumeric (ASCII String.fromCharCode)
    // -------------------------------------------------------------------------
    const origDecodeAlphanumeric = GeneralAppIdDecoderProto.decodeAlphanumeric
    GeneralAppIdDecoderProto.decodeAlphanumeric = function (pos) {
      const fiveBitValue = this.extractNumericValueFromBitArray(pos, 5)
      if (fiveBitValue === 15) {
        return origDecodeAlphanumeric.call(this, pos)
      }
      if (fiveBitValue >= 5 && fiveBitValue < 15) {
        const DecodedCharClass = Object.getPrototypeOf(
          origDecodeAlphanumeric.call(this, pos)
        ).constructor
        return new DecodedCharClass(pos + 5, String(fiveBitValue - 5))
      }
      const sixBitValue = this.extractNumericValueFromBitArray(pos, 6)
      if (sixBitValue >= 32 && sixBitValue < 58) {
        const DecodedCharClass = Object.getPrototypeOf(
          origDecodeAlphanumeric.call(this, pos)
        ).constructor
        return new DecodedCharClass(pos + 6, String.fromCharCode(sixBitValue + 33))
      }
      return origDecodeAlphanumeric.call(this, pos)
    }

    // -------------------------------------------------------------------------
    // Cacat 7: GeneralAppIdDecoder.decodeIsoIec646 (ASCII String.fromCharCode)
    // -------------------------------------------------------------------------
    const origDecodeIsoIec646 = GeneralAppIdDecoderProto.decodeIsoIec646
    GeneralAppIdDecoderProto.decodeIsoIec646 = function (pos) {
      const fiveBitValue = this.extractNumericValueFromBitArray(pos, 5)
      if (fiveBitValue === 15) {
        return origDecodeIsoIec646.call(this, pos)
      }
      if (fiveBitValue >= 5 && fiveBitValue < 15) {
        const DecodedCharClass = Object.getPrototypeOf(
          origDecodeIsoIec646.call(this, pos)
        ).constructor
        return new DecodedCharClass(pos + 5, String(fiveBitValue - 5))
      }
      const sevenBitValue = this.extractNumericValueFromBitArray(pos, 7)
      if (sevenBitValue >= 64 && sevenBitValue < 90) {
        const DecodedCharClass = Object.getPrototypeOf(
          origDecodeIsoIec646.call(this, pos)
        ).constructor
        return new DecodedCharClass(pos + 7, String.fromCharCode(sevenBitValue + 1))
      }
      if (sevenBitValue >= 90 && sevenBitValue < 116) {
        const DecodedCharClass = Object.getPrototypeOf(
          origDecodeIsoIec646.call(this, pos)
        ).constructor
        return new DecodedCharClass(pos + 7, String.fromCharCode(sevenBitValue + 7))
      }
      return origDecodeIsoIec646.call(this, pos)
    }

    // -------------------------------------------------------------------------
    // Cacat 8: GeneralAppIdDecoder.decodeNumeric (Pembagian integer Math.floor)
    // -------------------------------------------------------------------------
    function DecodedNumeric(newPosition, firstDigit, secondDigit) {
      this.newPosition = newPosition
      this.firstDigit = firstDigit
      this.secondDigit = secondDigit
    }
    DecodedNumeric.prototype.getNewPosition = function () { return this.newPosition }
    DecodedNumeric.prototype.getFirstDigit = function () { return this.firstDigit }
    DecodedNumeric.prototype.getSecondDigit = function () { return this.secondDigit }
    DecodedNumeric.prototype.getValue = function () { return this.firstDigit * 10 + this.secondDigit }
    DecodedNumeric.prototype.isFirstDigitFNC1 = function () { return this.firstDigit === 10 }
    DecodedNumeric.prototype.isSecondDigitFNC1 = function () { return this.secondDigit === 10 }
    DecodedNumeric.prototype.isAnyFNC1 = function () { return this.firstDigit === 10 || this.secondDigit === 10 }
    DecodedNumeric.FNC1 = 10

    GeneralAppIdDecoderProto.decodeNumeric = function (pos) {
      if (pos + 7 > this.information.getSize()) {
        const numeric_1 = this.extractNumericValueFromBitArray(pos, 4)
        if (numeric_1 === 0) {
          return new DecodedNumeric(this.information.getSize(), 10, 10)
        }
        return new DecodedNumeric(this.information.getSize(), numeric_1 - 1, 10)
      }
      const numeric = this.extractNumericValueFromBitArray(pos, 7)
      const digit1 = Math.floor((numeric - 8) / 11)
      const digit2 = (numeric - 8) % 11
      return new DecodedNumeric(pos + 7, digit1, digit2)
    }

    // -------------------------------------------------------------------------
    // Cacat 9: AI01decoder.encodeCompressedGtinWithoutAI
    // -------------------------------------------------------------------------
    const bits = new BitArray(50)
    bits.set(1)
    const decSample = createAbstractExpandedDecoder(bits)
    const AI01decoder = Object.getPrototypeOf(decSample.constructor.prototype).constructor

    AI01decoder.prototype.encodeCompressedGtinWithoutAI = function (
      buf,
      currentPos,
      initialBufferPosition
    ) {
      for (let i = 0; i < 4; ++i) {
        const currentBlock = this.getGeneralDecoder().extractNumericValueFromBitArray(
          currentPos + 10 * i,
          10
        )
        if (currentBlock < 100) {
          buf.append('0')
        }
        if (currentBlock < 10) {
          buf.append('0')
        }
        buf.append(currentBlock)
      }
      AI01decoder.appendCheckDigit(buf, initialBufferPosition)
    }

    // -------------------------------------------------------------------------
    // Cacat 10: RSSExpandedReader.isPartialRow
    // -------------------------------------------------------------------------
    RSSExpandedReader.isPartialRow = function (pairs, rows) {
      for (const r of rows) {
        let allFound = true
        for (const p of pairs) {
          let found = false
          for (const pp of r.getPairs()) {
            const pFinder = p.getFinderPattern
              ? p.getFinderPattern()
              : p.getFinderPatter
                ? p.getFinderPatter()
                : null
            const ppFinder = pp.getFinderPattern
              ? pp.getFinderPattern()
              : pp.getFinderPatter
                ? pp.getFinderPatter()
                : null
            if (
              p.getLeftChar()?.getValue() === pp.getLeftChar()?.getValue() &&
              p.getRightChar()?.getValue() === pp.getRightChar()?.getValue() &&
              pFinder?.getValue() === ppFinder?.getValue()
            ) {
              found = true
              break
            }
          }
          if (!found) {
            allFound = false
            break
          }
        }
        if (allFound) {
          return true
        }
      }
      return false
    }

    // -------------------------------------------------------------------------
    // Cacat 11: ExpandedRow.prototype.isEquivalent
    // -------------------------------------------------------------------------
    ExpandedRow.prototype.isEquivalent = function (otherPairs) {
      return this.checkEqualitity(this.pairs, otherPairs)
    }

    ExpandedRow.prototype.checkEqualitity = function (pair1, pair2) {
      if (!pair1 || !pair2) return false
      if (pair1.length !== pair2.length) return false
      for (let i = 0; i < pair1.length; i++) {
        const p1 = pair1[i]
        const p2 = pair2[i]
        if (!p1 || !p2) return false
        const p1Finder = p1.getFinderPattern
          ? p1.getFinderPattern()
          : p1.getFinderPatter
            ? p1.getFinderPatter()
            : null
        const p2Finder = p2.getFinderPattern
          ? p2.getFinderPattern()
          : p2.getFinderPatter
            ? p2.getFinderPatter()
            : null
        if (p1.getLeftChar()?.getValue() !== p2.getLeftChar()?.getValue()) return false
        if (p1.getRightChar()?.getValue() !== p2.getRightChar()?.getValue()) return false
        if (p1Finder?.getValue() !== p2Finder?.getValue()) return false
      }
      return true
    }

    // -------------------------------------------------------------------------
    // Cacat 12: RSSExpandedReader.storeRow
    // -------------------------------------------------------------------------
    RSSExpandedReader.prototype.storeRow = function (rowNumber, wasReversed) {
      let insertPos = 0
      let prevIsSame = false
      let nextIsSame = false
      while (insertPos < this.rows.length) {
        const erow = this.rows[insertPos]
        if (
          erow &&
          typeof erow.getRowNumber === 'function' &&
          erow.getRowNumber() > rowNumber
        ) {
          nextIsSame = erow.isEquivalent(this.pairs)
          break
        }
        if (erow && typeof erow.isEquivalent === 'function') {
          prevIsSame = erow.isEquivalent(this.pairs)
        }
        insertPos++
      }
      if (nextIsSame || prevIsSame) {
        return
      }
      if (RSSExpandedReader.isPartialRow(this.pairs, this.rows)) {
        return
      }
      this.rows.splice(
        insertPos,
        0,
        new ExpandedRow(this.pairs.slice(), rowNumber, wasReversed)
      )
      this.removePartialRows(this.pairs, this.rows)
    }

    // -------------------------------------------------------------------------
    // Cacat 13: RSSExpandedReader.checkRows
    // -------------------------------------------------------------------------
    RSSExpandedReader.prototype.checkRows = function (collectedRows, currentRow) {
      for (let i = currentRow; i < this.rows.length; i++) {
        const row = this.rows[i]
        this.pairs.length = 0
        for (const collectedRow of collectedRows) {
          this.pairs.push(...collectedRow.getPairs())
        }
        this.pairs.push(...row.getPairs())
        if (!RSSExpandedReader.isValidSequence(this.pairs)) {
          continue
        }
        if (this.checkChecksum()) {
          return this.pairs
        }
        const rs = [...collectedRows, row]
        try {
          return this.checkRows(rs, i + 1)
        } catch {
          // coba baris berikutnya
        }
      }
      throw new NotFoundException()
    }

    isPatched = true
    if (typeof window !== 'undefined') {
      window.__zxing_rss_expanded_patched__ = true
    }
    console.log('[ZXING-PATCH] Patch perbaikan RSS Expanded berhasil diterapkan.')
    return true
  } catch (err) {
    console.warn('[ZXING-PATCH] Gagal menerapkan patch RSS Expanded:', err)
    return false
  }
}
