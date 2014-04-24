var fs = require('fs');
var ndarray = require('ndarray');

function FormatError(expected, actual) {
	var message = "Expected " + expected + ", got " + actual;
	Error.call(this, message);
	this.message = message;
}
FormatError.prototype = Object.create(Error.prototype);

var chunkParsers = [];

exports.addChunkParser = function (id, func) {
	chunkParsers.unshift({id: id, func: func.bind(null)});
	return this;
}

var openWav = exports.open = function (wavData, callback) {
	if (typeof wavData === 'string') {
		return fs.readFile(wavData, function (err, buffer) {
			if (err) return callback(err);
			openWav(buffer, callback);
		});
	}
	
	var pos = 0;
	var chunkId = wavData.slice(0, 4).toString('hex');
	if (chunkId !== '52494646') return callback(new FormatError('0x52494646 ("RIFF")', chunkId));
	var format = wavData.slice(8, 12).toString('hex')
	if (format !== '57415645') return callback(new FormatError('0x57415645 ("WAVE")', format));
	
	pos = 12;

	var chunkArray = [], chunkDict = {};
	while (pos < wavData.length) {
		var size = wavData.readUInt32LE(pos + 4);
		var subChunk = {
			id: wavData.slice(pos, pos + 4).toString('ascii'),
			size: size,
			data: wavData.slice(pos + 8, pos + 8 + size)
		};
		pos += 8 + size;
		chunkParsers.some(function (parser) {
			if (parser.id === subChunk.id) {
				var result = parser.func(subChunk.data, chunkDict, chunkArray);
				if (result) {
					subChunk.data = result;
					return true;
				}
			}
			return false;
		})
		chunkArray.push(subChunk);
		var key = subChunk.id.replace(/\s*$/g, '').replace(/^\s/g, ''); // strip
		chunkDict[key] = subChunk.data;
	}
	callback(null, chunkDict, chunkArray);
};

//Built-in format parser
// Written based on documentation at https://ccrma.stanford.edu/courses/422/projects/WaveFormat/
exports.addChunkParser('fmt ', function (buffer, chunks) {
	return {
		format: buffer.readUInt16LE(0),
		channels: buffer.readUInt16LE(2),
		sampleRate: buffer.readUInt32LE(4),
		byteRate: buffer.readUInt32LE(8),
		blockAlign: buffer.readUInt16LE(12),
		bitsPerSample: buffer.readUInt16LE(14)
	};
});

exports.addChunkParser('data', function (buffer, chunks) {
	var format = chunks.fmt;
	if (format.format === 3) {
		// IEEE float
		var samples = buffer.length*8/format.bitsPerSample;
		if (format.bitsPerSample == 32) {
			var typedArray = new Float32Array(samples);
			for (var i = 0; i < samples; i++) {
				typedArray[i] = buffer.readFloatLE(i*4);
			}
			var nd = ndarray(typedArray, [format.channels, samples/format.channels]);
			return nd;
		} else {
			throw new Error('Unsupported sample format: ' + format.format);
		}
	} else {
		throw new Error('Unsupported sample format: ' + format.format);
	}
});