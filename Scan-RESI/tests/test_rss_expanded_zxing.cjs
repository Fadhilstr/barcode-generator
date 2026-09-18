const bwipjs = require('bwip-js');
const { MultiFormatReader, BinaryBitmap, HybridBinarizer, RGBLuminanceSource, DecodeHintType } = require('@zxing/library');
const { createCanvas, Image } = require('canvas');

async function run() {
  const text = "(01)11864376039282(10)ANDRE1234";
  console.log("Generating:", text);
  const png = await bwipjs.toBuffer({
    bcid: 'databarexpanded',
    text: text,
    scale: 3,
    includetext: false,
  });
  
  const img = new Image();
  img.src = png;
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, img.width, img.height);
  
  const hints = new Map();
  const formats = [ 13 ]; // RSS_EXPANDED
  hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
  
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  
  const source = new RGBLuminanceSource(imgData.data, imgData.width, imgData.height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  
  try {
    const result = reader.decode(bitmap);
    console.log("Decoded text:", result.getText());
    console.log("Decoded raw:", JSON.stringify(result.getText()));
  } catch (e) {
    console.log("Failed to decode:", e.message);
  }
}
run();
