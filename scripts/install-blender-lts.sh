#!/bin/bash
# Install Blender 5.2.2 LTS for WP4.15-V art pipeline
# D-053: Blender 5.2.2 LTS fijado como toolchain artístico

set -e

BLENDER_VERSION="5.2.2"
BLENDER_URL="https://download.blender.org/release/Blender5.2/blender-${BLENDER_VERSION}-linux-x64.tar.xz"
INSTALL_DIR="$HOME/.local/blender"
BLENDER_BIN="$INSTALL_DIR/blender-${BLENDER_VERSION}-linux-x64/blender"

echo "=== Blender ${BLENDER_VERSION} LTS Installer ==="
echo ""

# Check if already installed
if [ -f "$BLENDER_BIN" ]; then
    echo "Blender ${BLENDER_VERSION} already installed at:"
    echo "  $BLENDER_BIN"
    echo ""
    echo "To run the spike:"
    echo "  cd ~/RepositorioGitHub/landlord"
    echo "  $BLENDER_BIN --background --python tools/art-pipeline/blender/spike_compatibility.py"
    exit 0
fi

# Create install directory
mkdir -p "$INSTALL_DIR"

# Download Blender
echo "Downloading Blender ${BLENDER_VERSION}..."
echo "  URL: $BLENDER_URL"
echo "  This may take a few minutes (~300 MB)..."
echo ""

curl -L -o /tmp/blender.tar.xz "$BLENDER_URL"

# Extract
echo "Extracting to $INSTALL_DIR..."
tar -xf /tmp/blender.tar.xz -C "$INSTALL_DIR"

# Cleanup
rm /tmp/blender.tar.xz

# Verify
if [ -f "$BLENDER_BIN" ]; then
    echo ""
    echo "✓ Blender ${BLENDER_VERSION} installed successfully"
    echo ""
    echo "Binary location:"
    echo "  $BLENDER_BIN"
    echo ""
    echo "To add to PATH, add this to ~/.bashrc:"
    echo "  export PATH=\"$INSTALL_DIR/blender-${BLENDER_VERSION}-linux-x64:\$PATH\""
    echo ""
    echo "To run the WP4.15-V spike:"
    echo "  cd ~/RepositorioGitHub/landlord"
    echo "  $BLENDER_BIN --background --python tools/art-pipeline/blender/spike_compatibility.py"
    echo ""
else
    echo "✗ Installation failed"
    exit 1
fi
