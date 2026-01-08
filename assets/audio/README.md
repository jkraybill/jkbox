# Audio Assets for jkbox

## Directory Structure

```
audio/
├── lobby/          # Existing lobby music (random selection)
├── music/          # Background music tracks
│   ├── intro.mp3   # Title screen music (placeholder - needs Suno)
│   ├── lobby.mp3   # Lobby background music
│   └── victory.mp3 # Final winner celebration (placeholder - needs Suno)
└── sfx/            # Sound effects
    ├── game-start.mp3      # When game starts
    ├── winner-chime.mp3    # Round winner reveal
    ├── countdown-tick.mp3  # Countdown ticks
    ├── countdown-go.mp3    # Countdown "GO!"
    └── players/            # Player-specific sounds (12 total)
        ├── boing.mp3
        ├── whoosh.mp3
        ├── pop.mp3
        ├── ding.mp3
        ├── honk.mp3
        ├── squeak.mp3
        ├── slide-whistle.mp3
        ├── spring.mp3
        ├── kazoo.mp3
        ├── quack.mp3
        ├── cowbell.mp3
        └── airhorn.mp3
```

## Suno Prompts for Custom Music

### Intro Music (intro.mp3)
Replace the placeholder with Suno-generated music using this prompt:
> Playful, whimsical game show intro music. Think classic TV game show with modern twist. Upbeat, inviting, 10-15 seconds. Builds to crescendo. Instrumental only.

### Victory Fanfare (victory.mp3)
> Triumphant celebration music. Confetti moment. 15-20 seconds. Brass fanfare into celebratory groove. Victorious and joyful. Instrumental only.

## Audio Specifications

- **Music**: MP3, 128-192kbps, stereo
- **SFX**: MP3, 128kbps, mono
- **Player sounds**: Keep under 2 seconds for snappy feedback

## Sources

- **Player sounds**: Curated from SSE Library, Gold Library, Red Library
- **Game SFX**: Converted from professional WAV sources
- **Music**: Lobby track from royalty-free source; intro/victory to be generated via Suno
