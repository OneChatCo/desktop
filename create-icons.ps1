# PowerShell script to create icon files
# This script requires ImageMagick to be installed

$iconPath = ".\build\icon.png"
$buildDir = ".\build"

# Check if ImageMagick is available
try {
    magick -version | Out-Null
    Write-Host "ImageMagick found, creating icon files..."
    
    # Create Windows ICO file (multiple sizes embedded)
    magick $iconPath -resize 256x256 -resize 128x128 -resize 64x64 -resize 48x48 -resize 32x32 -resize 16x16 "$buildDir\icon.ico"
    
    # Create macOS ICNS file
    magick $iconPath "$buildDir\icon.icns"
    
    Write-Host "Created icon.ico and icon.icns"
    
} catch {
    Write-Host "ImageMagick not found. Electron-builder will auto-convert the PNG file during build."
    Write-Host "Alternatively, you can:"
    Write-Host "1. Install ImageMagick and run this script"
    Write-Host "2. Use online converters to create .ico and .icns files"
    Write-Host "3. Let electron-builder handle the conversion automatically"
}
