# KlippyDash
Lightweight Klipper Dashboard built on Moonraker API

## Why?
Mainsail and Fluidd are great for control, but I was looking for a lightweight dashboard that shows only the information I care about.  I wanted something that could handle multiple printers and would display cleanly on both desktop and mobile.  

## Features
* Camera View
  * Uses snapshot modes and refreshes every 1 second.  If you mouse over the image, you will get a video feed.
* Printing Metrics
  * Filename
  * Extruder Temp
  * Bed Temp
  * Print Times & Estimates
  * Filament Used
* Basic Controls
  * Pause
  * Resume
  * Cancel
  * E-Stop

## TODO
* Add authentication
* Add additional metrics
  * speed
  * flow
  * layer counts?
  * system_stats (load/cp/mem)
* Add additional basic controls
  * restart firmware / klipper
  * home / preheat
* Update to websockets
