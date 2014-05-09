# ndarray-wav

Read/write RIFF WAVE files as ndarrays.

## Supported formats

Currently supported formats (for read and write) are:
* 16-bit linear (CD standard)
* 24-bit linear (CD standard)
* 32-bit IEEE floating-point

Adding new (uncompressed) sample formats is relatively easy, though, so if you need one just raise an issue on GitHub and I'll put in.

## API

### Reading

```javascript
var ndarrayWav = require('ndarray-wav');

ndarrayWav.open('input.wav', function (err, chunkMap, chunkArr) {
    var format = chunks.fmt;
    var ndSamples = chunks.data; // the wave data as an ndarray
    assert(format.channels == ndSamples.shape[0]);
    var numSamples = arr.shape[1];
});
```

Regardless of the sample format of the WAV file itself, the data is always returned as floating-point.

### Writing

```javascript
ndarrayWav.write('output.wav', ndSamples, format, function (error) {...});
```

In the `write()` method, `format` is optional.  If omitted, it defaults to 44100Hz. 16-bit audio.

The structure of `format` is the same as `chunkMap.fmt` when you read:

```javascript
var format = {
	sampleRate: 44100,
	format: 1, // 1 is the default "linear" format (two's complement integer), 3 is floating-point.
	bitsPerSample: 16, //
	extraChunks: {...}
};
```

All properties are optional.

## What's all this about "chunks"?

WAV files are organised into chunks.  Each is labelled with a four-character ID - the main ones are `"fmt "` and `"data"`.

When reading, this ID is stripped of whitespace and placed in `chunkMap` (second argument in callback).  Additionally, `chunkArr` is an array that holds the same chunks in the order they appeared in the file (where each entry has two keys `"id"` and `"data"`).

There are built-in parsers for `fmt` and `data` chunks.  This means that the format will always be available (parsed) as `chunkMap.fmt`, and the wave data is in `chunkMap.data`.

When writing `extraChunks` can contain additional chunks to write (e.g. `bext`).  It can be an object (like `chunkMap`) that maps IDs to Buffers, or if order is important it can be an array (like `chunkArr`).

### Chunk parsers

You can add parsers for particular types of chunk (e.g. `bext` for the broadcast-extension chunk).  It works like this:

```javascript
ndarrayWav.addChunkParser('bext', function (buffer) {
    return buffer.toString('ascii');
});
```

You can register more than one parser for a particular type of chunk.  If you return something true-ish, then it stops, otherwise it continues.  Parsers are tried in reverse order (most recently-registered first).

This is actually the mechanism that is used to parse the format and wave data (`fmt` and `data`).

## Thanks

Thanks to Chinmay Pendharkar [(notthetup)](https://github.com/notthetup) for 24-bit write support plus some other details.