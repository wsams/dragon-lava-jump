# Dragon Lava Jump

A side-scrolling platformer in which you guide a dragon across platforms, over lava, past enemies, and to the golden door. Built with **HTML**, **CSS**, **JavaScript**, and **Phaser 3**.

## About the game

- **Goal:** Reach the golden door at the end of the level before running out of lives. Collect dots, avoid or defeat slimes, bats, and crawlers, and use lava bounces and power-ups to get ahead. You can hold only one power-up at a time (lava orb or fire totem); picking up a new one replaces the previous. **Score** is earned from dots, creature kills, power-ups, and winning; higher difficulty multiplies points. Scores are stored per level per user (or "anonymous" if not signed in).
- **Movement:** Run left/right, jump (including double jump in mid-air), slam down (hold Down/S in the air to drop fast), and use an air boost to dash forward. Fire breath can defeat slimes and crawlers when you have the fire totem.
- **Hazards:** Lava (instant death unless you have a lava bounce), slimes, bats, crawlers, and stalactites. Checkpoints and extra lives help you progress.
- **Levels:** Play random generated levels or saved levels. Difficulty affects platform layout, enemies, and items (e.g. lava bounce, fire totem).
- **Instructions:** The menu **Instructions** button opens a dialog with “How to play”—keyboard and on-screen controls, goal, and biome-specific hazards. The page footer shows only the repo and Phaser acknowledgements.

## How to run

Open `dragonlavajump.html` in a browser, or serve the project folder with any static file server (e.g. `npx serve .` or `python -m http.server`) and open the page. Audio may require a user gesture (e.g. click or tap) before playing in some browsers.

## Controls

- **Arrow keys / A,D:** Move left and right  
- **Down arrow / S:** Slam down (in the air only—drop straight down at a fast speed, Tetris-style)  
- **Space:** Jump (double jump allowed once per air time)  
- **F:** Air boost (forward dash in the air, once per jump)  
- **G:** Fire breath (when you have the fire totem)  
- **On-screen buttons (touch):** Left, Right, Down (slam), Breath (flame icon), Jump (up arrow), and Boost (left–right arrows). Buttons use **icons only** (no text labels) so holding a button doesn’t trigger OS text selection. Full controls and goal text are in the **Instructions** dialog (menu button).

## Credits

- **Audio**
  - music.mp3 (Sound Effect by freesound_community from Pixabay)
  - jump.mp3 (https://sounddino.com/en/effects/arcade/ - Jump in the game)
  - death.mp3 (https://sounddino.com/en/effects/arcade/ - Level failed)
  - lava.mp3 (https://sounddino.com/en/search/?s=lava - Lava)
  - shield-loss.mp3 (https://sounddino.com/en/effects/arcade/ - Hit an obstacle)
  - bat.mp3 (https://sounddino.com/en/effects/arcade/ - space creak)
  - crawler.mp3 (https://sounddino.com/en/effects/arcade/ - fast travel)
  - slime.mp3 (https://sounddino.com/en/effects/arcade/ - Shot with vibration)
  - breath.mp3 (https://sounddino.com/en/effects/arcade/ - Space buzz)
  - win.mp3 (https://sounddino.com/en/effects/game-alerts/ - Successfully completed a level)
  - platform-step.mp3 (https://sounddino.com/en/effects/arcade/ - thumping sound)
  - platform-fall.mp3 (https://sounddino.com/en/effects/arcade/ - Sound for an arcade game (Arcade Chirp Descend))
  - boost.mp3 (https://sounddino.com/en/effects/effects/ - Strong mace strike)
  - dot.mp3 (https://sounddino.com/en/effects/drops/ - water drop soft calm close)
  - checkpoint.mp3 (https://sounddino.com/en/effects/arcade/ - Sound for an arcade game (Arcade Alarm))
- **Images**
  - dragon.ico (https://icon-icons.com/icon/dragon-face/98751 - Dragon face - Free Icon in PNG and SVG By Google)

This project is not licensed for reuse or distribution.
