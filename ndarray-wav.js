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

var writeWav = exports.write = function (wavFile, wavData, options, callback) {
	if (typeof options === 'function') {
		callback = options;
		options = {};
	}
	options = options || {};
	var extraChunks = options.extraChunks || [];
	var extraChunkLength = 0;
	if (!Array.isArray(extraChunks)) {
		var chunkMap = extraChunks;
		extraChunks = [];
		for (var key in chunkMap) {
			extraChunks.push({id: key, data: chunkMap[key]});
		}
	}
	extraChunks.forEach(function (chunk) {
		extraChunkLength += 8 + chunk.data.length;
	});
	
	var format = options.format || 3;
	var bitsPerSample = options.bitsPerSample || 32;
	var sampleRate = options.sampleRate || 44100;
	
	var channels = wavData.shape[0];
	var samples = wavData.shape[1];
	var byteLength = 44 + samples*channels*bitsPerSample/8 + extraChunkLength;
	
	var bufferPos;
	var buffer = new Buffer(byteLength);
	buffer.write('RIFF', 0, 'ascii');
	buffer.writeUInt32LE(byteLength - 8, 4);
	buffer.write('WAVE', 8, 'ascii');
	// Format chunk
	buffer.write('fmt ', 12, 'ascii');
	buffer.writeUInt32LE(16, 16);
	buffer.writeUInt16LE(format, 20);
	buffer.writeUInt16LE(channels, 22);
	buffer.writeUInt32LE(sampleRate, 24);
	buffer.writeUInt32LE(sampleRate*channels*bitsPerSample/8, 28);
	buffer.writeUInt16LE(channels*bitsPerSample/8, 32);
	buffer.writeUInt16LE(bitsPerSample, 34);

	bufferPos = 36;
	extraChunks.forEach(function (chunk) {
		buffer.write((chunk.id + '     ').substring(0, 4), bufferPos, 'ascii');
		buffer.writeUInt32LE(chunk.data.length, bufferPos + 4);
		bufferPos += 8 + chunk.data.length;
	});
	
	// Data chunk
	buffer.write('data', bufferPos, 'ascii');
	buffer.writeUInt32LE(byteLength - bufferPos - 8, bufferPos + 4);
	bufferPos += 8;
		
	if (format === 3) {
		if (bitsPerSample === 32) {
			for (var sampleNum = 0; sampleNum < samples; sampleNum++) {
				for (var channelNum = 0; channelNum < channels; channelNum++) {
					var value = wavData.get(channelNum, sampleNum);
					buffer.writeFloatLE(value, bufferPos);
					bufferPos += 4;
				}
			}
		} else {
			throw new Error('Unsupported bit depth for write: ' + bitsPerSample);
		}
	} else {
		throw new Error('Unsupported sample format for write: ' + format);
	}
	
	fs.writeFile(wavFile, buffer, callback);
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
			var nd = ndarray(typedArray, [samples/format.channels, format.channels]).transpose(1, 0);
			return nd;
		} else {
			throw new Error('Unsupported bit depth: ' + format.bitsPerSample);
		}
	} else {
		throw new Error('Unsupported sample format: ' + format.format);
	}
});