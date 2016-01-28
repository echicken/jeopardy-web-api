var	fs = require('fs'),
	util = require('util'),
	events = require('events'),
	sqlite3 = require('sqlite3'),
	Iconv = require('iconv').Iconv,
	clj_fuzzy = require('clj-fuzzy');

var Database = function () {

	var self = this;
	events.EventEmitter.call(this);

	var db = new sqlite3.Database('clues.db');

	this.getCategoryIDs = function (callback) {
		db.all(
			'SELECT categories.id FROM categories ORDER BY categories.id ASC',
			function (err, rows) {
				if (err !== null) {
					console.log(err);
					callback([]);
					return;
				}
				var ids = rows.map(
					function (row) {
						return row.id;
					}
				);
				callback(ids);
			}
		);
	}

	this.getCategories = function (offset, count, callback) {
		db.all(
			'SELECT ' +
				'categories.id as "category_id", categories.category, ' +
				'clues.id as "clue_id", clues.round ' +
			'FROM ' +
				'categories, clues, classifications ' +
			'WHERE ' +
				'categories.id >= ? ' +
				'AND ' +
				'categories.id <= (? + ?) ' +
				'AND ' +
				'classifications.clue_id = clues.id ' +
				'AND ' +
				'categories.id = classifications.category_id ' +
			'ORDER BY ' +
				'categories.id ASC, clues.round ASC, clues.value ASC',
			[offset, offset, count],
			function (err, rows) {
				if (err !== null) {
					console.log(err);
					callback({});
					return;
				}
				var categories = {};
				rows.forEach(
					function (row) {
						if (typeof categories[row.category_id] === 'undefined') {
							categories[row.category_id] = {
								name : row.category,
								clues : [0, 0, 0]
							};
						}
						categories[row.category_id].clues[row.round - 1]++
					}
				);
				callback(categories);
			}
		);
	}

	this.getCategory = function (id, callback) {
		db.all(
			'SELECT ' +
				'categories.id as "category_id", categories.category, ' +
				'clues.id as "clue_id", clues.round ' +
			'FROM ' +
				'categories, clues, classifications ' +
			'WHERE ' +
				'categories.id = ? ' +
				'AND ' +
				'classifications.clue_id = clues.id ' +
				'AND ' +
				'classifications.category_id = ? ' +
			'ORDER BY ' +
				'categories.id ASC, clues.round ASC, clues.value ASC',
			[id, id],
			function (err, rows) {
				if (err !== null) {
					console.log(err);
					callback({});
					return;
				}
				var category = {
					name : '',
					clues : [[], [], []]
				};
				rows.forEach(
					function (row) {
						if (category.name === '') {
							category.name = row.category;
						}
						category.clues[row.round - 1].push(row.clue_id);
					}
				);
				callback(category);
			}
		);
	}

	this.getCategoryClues = function (id, round, callback) {
		db.all(
			'SELECT ' +
				'clues.id, clues.value, ' +
				'documents.clue, documents.answer ' +
			'FROM ' +
				'clues, documents, categories, classifications ' +
			'WHERE ' +
				'categories.id = ? ' +
				'AND ' +
				'classifications.category_id = ? ' +
				'AND ' +
				'classifications.clue_id = clues.id ' +
				'AND ' +
				'clues.round = ? ' +
				'AND ' +
				'documents.id = clues.id ' +
			'ORDER BY clues.value ASC',
			[id, id, round],
			function (err, rows) {
				if (err !== null) {
					console.log(err);
					callback([]);
					return;
				}
				callback(typeof rows === 'undefined' ? [] : rows);
			}
		);
	}

	this.getClue = function (id, callback) {
		db.get(
			'SELECT ' +
				'clues.id, clues.round, clues.value, ' +
				'documents.clue, documents.answer ' +
			'FROM ' +
				'clues, documents ' +
			'WHERE ' +
				'clues.id = ? ' +
				'AND ' +
				'documents.id = ?',
			[id, id],
			function (err, row) {
				if (err !== null) {
					console.log(err);
					callback({});
					return;
				}
				callback(typeof row === 'undefined' ? {} : row);
			}
		);
	}

	this.getRandomClue = function (callback) {
		db.get(
			'SELECT ' +
				'clues.id, clues.value, ' +
				'documents.clue, documents.answer, ' +
				'categories.category ' +
			'FROM ' +
				'clues, documents, categories, classifications ' +
			'WHERE ' +
				'clues.id = (SELECT id FROM clues ORDER BY RANDOM() LIMIT 1) ' +
				'AND ' + 
				'clues.id = documents.id ' +
				'AND ' +
				'classifications.clue_id = clues.id ' +
				'AND ' +
				'categories.id = classifications.category_id',
			function (err, row) {
				if (err !== null) {
					console.log(err);
					callback({});
					return;
				}
				callback(typeof row === 'undefined' ? {} : row);
			}
		);
	}

	function compareAnswer(answer1, answer2) {

		function normalize(str) {

			var iconv = new Iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE');

			str = iconv.convert(str).toString().toUpperCase();

			// No need to phrase as a question
			str = str.replace(
				/^(WH(O|AT|EN|ERE|Y)|HOW)\s(IS|WAS|ARE|WERE)\s/,
				''
			);

			// Strip out unnecessary leading words
			str = str.replace(/^(A|AN|AT|IN|THE)\s/, '');

			// Honorifics
			str = str.replace(/(MR|MS|MRS|DR|CPT|CAPT)\.*\s/g, ' ');
			str = str.replace(
				/(MIS(TER|S|SUS)|DOCTOR|KING|QUEEN|PRINC(E|ESS)|CAPTAIN)\s/g,
				''
			);

			str = str.replace(/&/g, 'AND');
			str = str.replace(/[^\w]/g, ' ');
			str = str.replace(/\s\s+/g, ' ');
			str = str.trim();

			return str;

		}

		var match = /\(.*\)/.exec(answer2);
		if (match !== null) {
			var answer2a = answer2.replace(match[0], '');
			if (normalize(answer1) === normalize(answer2a)) return true;
		}

		var a1 = normalize(answer1);
		var a2 = normalize(answer2);

		if (a1 === a2) return true;

		// THIS & THAT matches THIS & THAT or THAT & THIS
		var a1a = a1.split(/\sAND\s/).map(function (e) { return normalize(e); });
		var a2a = a2.split(/\sAND\s/).map(function (e) { return normalize(e); });
		if (a1a.length === 2 && a2a.length === 2 &&
			(a1a[0] === a2a[0] || a1a[0] === a2a[1]) &&
			(a1a[1] === a2a[1] || a1a[1] === a2a[0])
		) {
				return true;
		} else if (a1a.length === 1 && a1a[0] === a2a.join(' ')) {
			return true;
		}

		if (clj_fuzzy.metrics.dice(a1, a2) >= .8) return true;

		return false;

	}

	this.compareAnswer = function (id, answer, callback) {
		db.get(
			'SELECT answer FROM documents WHERE id = ?',
			[ id ],
			function (err, row) {
				if (err !== null) {
					console.log(err);
					callback({});
					return;
				}
				if (typeof row === 'undefined') {
					callback({});
					return;
				}
				callback(compareAnswer(decodeURIComponent(answer), row.answer));
			}
		);
	}

}
util.inherits(Database, events.EventEmitter);

module.exports = Database;
