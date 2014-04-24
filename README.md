# ndarray-wav

Read RIFF WAVE files as ndarrays.  In future, it will be able to write the data back to .WAVs again.

**WARNING** - it's not exactly ready for wide use, because I'm just developing it for myself.

## Current limitations

#1: It only reads 32-bit floating-point data right now.  This is pretty easy to fix, though, so if you need it just raise an issue and I'll put in any PCM type you like.

## API

```javascript
var ndarrayWav = require('ndarray-wav');

ndarrayWav.open('input.wav', function (err, chunkMap, chunkArr) {
    var format = chunks.fmt;
    var arr = chunks.data;
    assert(format.channels == arr.shape[0]);
    var numSamples = arr.shape[1];
});
```

### What?  "Chunks"?

WAV files are organised into chunks.  Each is labelled with a four-character ID (the main ones being `"fmt "` or `"data"`).

This ID is stripped of whitespace and placed in `chunkMap` (second argument in callback).  Additionally, `chunkArr` is an array that holds the same chunks in the order they appeared in the file.

### Chunk parsers

You can add parsers for particular types of chunk (e.g. `bext` for the broadcast-extension chunk).  It works like this:

```javascript
ndarrayWav.addChunkParser('bext', function (buffer) {
    return buffer.toString('ascii');
});
```

You can register more than one parser for a particular type of chunk.  If you return something true-ish, then it stops, otherwise it continues.  Parsers are tried in reverse order (most recently-registered first).

This is actually the mechanism that is used to parse the format and wave data (`fmt` and `data`).
