# EG Arduino Simulator 2.0.8

WordPress visual Arduino and electronics simulator.

## Shortcode

```text
[eg_arduino_simulator]
```

## Main features

- Official Wokwi Elements component visuals.
- Real community custom-chip manifests loaded from their original GitHub repositories.
- Fritzing breadboard-view artwork and connector metadata.
- Functional breadboard buses imported from Fritzing `.fzp` definitions.
- Realistic interactive L298N module and TT gear motor.
- Components can be moved, resized, rotated, duplicated, locked, and reordered.
- Wires stay above component artwork while physical pin targets remain above the wires.
- Manual wire elbows and movable wire points/segments.
- Arduino/C++ syntax highlighting through CodeMirror.
- Lightweight educational execution for common Arduino APIs.
- Project save, import, export, undo, and redo.

## Custom-chip loading

The plugin uses a same-origin WordPress asset proxy with an explicit repository allowlist. It attempts the common Wokwi paths for each custom-chip package:

- `chip.json`
- `chip/chip.json`
- `wokwi-custom-chip.json`
- `chip.svg`
- `chip/chip.svg`

When the package supplies SVG artwork, the original artwork is used. When it only supplies a chip manifest, the plugin renders a Wokwi-style custom-chip body using the original pin list rather than inventing a different module.

Wokwi community WASM packages are identified as behavior-ready, but the plugin does not claim full compatibility with every Wokwi host API or every Arduino library. The simulator includes direct behavior for common digital, analog, PWM, relay, servo, LED, L298N, and TT-motor workflows.

## Fritzing components

The simulator reads the original `.fzp` part metadata, loads the referenced breadboard SVG, obtains pin positions from connector SVG IDs, and imports internal bus groups. Breadboard sockets therefore remain attached while the board is moved, rotated, or resized.

## Installation

1. Upload the plugin ZIP through **Plugins → Add New → Upload Plugin**.
2. Activate **EG Arduino Simulator**.
3. Add `[eg_arduino_simulator]` to a page.
4. Clear page/CDN cache after replacing an older version.
