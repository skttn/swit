$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
[xml]$svg = Get-Content (Join-Path $root 'logo.svg') -Raw
# The source logo uses absolute M/L/C/Z commands. Render at 4x for smooth small icons.
foreach ($size in @(16, 48, 128)) {
    $bitmap = [System.Drawing.Bitmap]::new($size * 4, $size * 4)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.ScaleTransform($size * 4 / 128, $size * 4 / 128)
    foreach ($shape in $svg.svg.path) {
        $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $tokens = $shape.d.Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)
        $i = 0; $x = 0; $y = 0
        while ($i -lt $tokens.Length) {
            $command = $tokens[$i++]
            switch ($command) {
                'M' { $x = [float]$tokens[$i++]; $y = [float]$tokens[$i++]; $path.StartFigure() }
                'L' {
                    $nx = [float]$tokens[$i++]; $ny = [float]$tokens[$i++]
                    $path.AddLine($x, $y, $nx, $ny); $x = $nx; $y = $ny
                }
                'C' {
                    $x1 = [float]$tokens[$i++]; $y1 = [float]$tokens[$i++]
                    $x2 = [float]$tokens[$i++]; $y2 = [float]$tokens[$i++]
                    $nx = [float]$tokens[$i++]; $ny = [float]$tokens[$i++]
                    $path.AddBezier($x, $y, $x1, $y1, $x2, $y2, $nx, $ny)
                    $x = $nx; $y = $ny
                }
                'Z' { $path.CloseFigure() }
                default { throw "Unsupported SVG command: $command" }
            }
        }
        if ($shape.transform) {
            # Keep the rasterized icons consistent with the SVG source transform.
            $matrix = [System.Drawing.Drawing2D.Matrix]::new()
            $matrix.Translate(64, 64)
            $matrix.Scale(1.12, 1.35)
            $matrix.Translate(-64, -64)
            $path.Transform($matrix)
            $matrix.Dispose()
        }
        $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($shape.fill))
        $graphics.FillPath($brush, $path)
        $brush.Dispose(); $path.Dispose()
    }
    $output = [System.Drawing.Bitmap]::new($size, $size)
    $scaled = [System.Drawing.Graphics]::FromImage($output)
    $scaled.Clear([System.Drawing.Color]::Transparent)
    $scaled.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $scaled.DrawImage($bitmap, 0, 0, $size, $size)
    $output.Save((Join-Path $root "icon$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $scaled.Dispose(); $output.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
    Write-Output "Generated icon$size.png (transparent)"
}