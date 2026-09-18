package Wahana::Controller::DocsController;
use strict;
use warnings;
use FindBin;
use Wahana::Response qw(cors_headers);

sub get_openapi_yaml {
    my ($req) = @_;

    # Cari file openapi yaml di beberapa kemungkinan lokasi
    my @candidates = (
        "$FindBin::Bin/etc/api/scanresi.yaml",
        "$FindBin::Bin/../etc/api/scanresi.yaml",
        "/app/etc/api/scanresi.yaml",
        "/Documents/Scan-resi-magang/backend/etc/api/scanresi.yaml"
    );

    my $content = '';
    for my $file (@candidates) {
        if (-f $file) {
            if (open my $fh, '<', $file) {
                local $/;
                $content = <$fh>;
                close $fh;
                last;
            }
        }
    }

    return {
        _is_raw => 1,
        status  => 200,
        headers => {
            'Content-Type' => 'text/yaml; charset=utf-8',
            cors_headers(),
        },
        body => $content || "# OpenAPI spec not found\n",
    };
}

sub get_swagger_ui {
    my ($req) = @_;

    my $html = <<'HTML';
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Wahana Express - REST API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5/favicon-32x32.png" sizes="32x32" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; font-family: sans-serif; }
    .topbar { background-color: #0d233a !important; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/api/openapi.yaml",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>
HTML

    return {
        _is_raw => 1,
        status  => 200,
        headers => {
            'Content-Type' => 'text/html; charset=utf-8',
            cors_headers(),
        },
        body => $html,
    };
}

1;
