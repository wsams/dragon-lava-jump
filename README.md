# Dragon Lava Jump 🐉🔥

A challenging side-scrolling platformer game written in pure HTML, CSS, and JavaScript. Control a dragon through procedurally generated levels filled with lava, enemies, and collectibles!

## 🎮 About The Game

Dragon Lava Jump is a fast-paced platformer where you guide a dragon through treacherous levels filled with rising lava, flying bats, jumping slimes, crawling enemies, and dangerous stalactites. Your mission is to reach the golden pillar at the end of each level while collecting all 30 dots and avoiding deadly obstacles.

### Features

- **Procedurally Generated Levels**: Each level is uniquely generated with a seed-based system
- **Multiple Abilities**: 
  - Double jump for aerial maneuvers
  - Mid-air boost for extra distance
  - Fire breath to defeat enemies (when powered up)
- **Dynamic Gameplay Elements**:
  - Rising lava that keeps you moving
  - Checkpoint poles to save progress
  - Power-ups including fire totems and lava bounce orbs
  - Falling platforms that add challenge
- **Enemy Variety**: 
  - Slimes that jump around
  - Flying bats that pursue you
  - Crawlers that patrol platforms
  - Deadly stalactites hanging from the ceiling
- **Level Sharing**: Share levels via URL with difficulty settings
- **Persistent Progress**: Your best times and dot collections are saved locally
- **Responsive Controls**: Keyboard controls and on-screen touch buttons for mobile

## 🚀 Installation

No installation required! Dragon Lava Jump runs entirely in your web browser.

### Quick Start

1. Clone this repository:
   ```bash
   git clone https://github.com/wsams/dragon-lava-jump.git
   cd dragon-lava-jump
   ```

2. Open the game in your browser:
   ```bash
   # Simply open the HTML file in any modern web browser
   open dragonlavajump.html
   # Or on Linux:
   xdg-open dragonlavajump.html
   # Or on Windows:
   start dragonlavajump.html
   ```

3. That's it! Start playing!

### Hosting Online

To host the game on a web server:

1. Upload all files to your web server, maintaining the directory structure
2. Ensure `dragonlavajump.html` is accessible
3. No server-side processing required - it's all client-side JavaScript!

## 🎯 How To Play

### Objective

- **Primary Goal**: Reach the golden pillar at the end of the level
- **Secondary Goal**: Collect all 30 dots (Pac-Man style) for the best score
- **Avoid**: Touching lava (instant death), enemies (resets to checkpoint), and stalactites

### Controls

#### Keyboard Controls (Desktop)
- **← →** (Arrow Keys): Move left and right
- **Space**: Jump (press again in air for double jump)
- **F**: Boost (once per jump, only works in air)
- **G**: Fire breath (requires fire totem power-up)

#### Touch Controls (Mobile/Tablet)
Use the on-screen buttons at the bottom of the game:
- **Left/Right**: Movement buttons
- **Jump**: Jump button (tap again in air for double jump)
- **Boost**: Mid-air boost button
- **Breath**: Fire breath button

### Game Mechanics

#### Lives & Checkpoints
- You start with 3 lives
- Touch checkpoint poles to save your progress
- Dying sends you back to the last checkpoint
- Losing all lives restarts the level

#### Power-Ups
- **Fire Totem** (flame icon): Grants unlimited fire breath until you're hit
  - Fire breath defeats enemies on contact
  - One hit removes the power-up
- **Orange Orb**: Allows you to bounce on lava once
- **Checkpoint Poles**: Touch to set your respawn point

#### Enemies
- **Slimes**: Jump around on platforms - avoid touching them
- **Bats**: Fly through the air and chase you
- **Crawlers**: Patrol around platforms in a loop
- **Stalactites**: Hanging from the ceiling - don't touch!

#### Platform Types
- **Solid Platforms**: Normal platforms you can stand on
- **Falling Platforms**: Drop shortly after you step on them

#### Scoring
- Complete the level as fast as possible
- Collect all 30 dots for maximum points
- Your best time and dot count are saved per level

### Menu Options

- **Level Dropdown**: Select from previously played levels or generate new ones
- **New Level Button**: Generate a new random level
- **Share Button**: Copy a shareable link to the current level

### URL Parameters

Share specific levels using URL hash parameters:
```
dragonlavajump.html#<seed>/<difficulty>
```
- `seed`: Numerical seed for level generation
- `difficulty`: 1-30 (optional, defaults to 15)

Example: `dragonlavajump.html#12345/20`

## 🛠️ Technical Details

### Technologies Used
- **HTML5**: Canvas API for rendering
- **CSS3**: Styling and responsive design
- **Vanilla JavaScript**: ES6+ modules for game logic
- **LocalStorage API**: Saving progress and best scores

### Project Structure

```
dragon-lava-jump/
├── dragonlavajump.html       # Main HTML file
├── dragonlavajump-css/       # Stylesheets
│   └── styles.css            # Game styling
├── dragonlavajump-js/        # JavaScript modules
│   ├── main.js               # Entry point and game loop
│   ├── state.js              # Game state management
│   ├── constants.js          # Game constants and physics
│   ├── input.js              # Input handling (keyboard/touch)
│   ├── update.js             # Game update logic
│   ├── draw.js               # Rendering logic
│   ├── levelGen.js           # Procedural level generation
│   ├── gameFlow.js           # Level loading and game flow
│   ├── storage.js            # LocalStorage management
│   └── rng.js                # Random number generator (seeded)
└── README.md                 # This file
```

### Browser Compatibility

Requires a modern web browser with support for:
- HTML5 Canvas
- ES6+ JavaScript modules
- LocalStorage API
- CSS3

Tested on:
- Chrome/Edge (Chromium-based)
- Firefox
- Safari

### Performance

The game includes an FPS benchmark system that automatically adjusts to your device's performance. It runs smoothly on most modern devices, including mobile phones and tablets.

## 🎨 Customization

Feel free to modify the game by editing the JavaScript modules:
- Adjust physics constants in `constants.js`
- Modify level generation in `levelGen.js`
- Change visual appearance in `draw.js` and `styles.css`
- Add new game mechanics by extending the modules

## 📝 License

This project is open source. Feel free to use, modify, and distribute as you see fit.

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Share your custom levels

## 🎮 Tips & Tricks

1. **Master the double jump**: Timing your second jump is crucial for reaching high platforms
2. **Use boost wisely**: The mid-air boost recharges each time you land
3. **Watch the lava**: It rises slowly but relentlessly - keep moving!
4. **Checkpoint early**: Touch every checkpoint pole you see
5. **Fire totem strategy**: When powered up, one hit kills enemies but also removes the power
6. **Falling platforms**: Listen for the visual cue and jump quickly
7. **Collect dots strategically**: Sometimes it's better to get the dots on your way back from a high platform

Enjoy the game! 🐉
