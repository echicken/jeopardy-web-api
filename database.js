var	fs = require('fs'),
	util = require('util'),
	events = require('events'),
	sqlite3 = require('sqlite3');

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
				'clues.id = documents.id ' +
				'AND ' +
				'classifications.clue_id = clues.id ' +
				'AND ' +
				'categories.id = classifications.category_id ' +
			'ORDER BY RANDOM() LIMIT 1',
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

			str = str.toUpperCase();

			str = str.replace(/\s\s+/g, ' ');

			/*	You needn't phrase your response in the form of a question, but
				some players might think it's necessary. Let's help them out. */
			str = str.replace(/^(WHO\s)(IS|WAS|ARE|WERE)\s/,	'');
			str = str.replace(/^(WHAT\s)(IS|WAS|ARE|WERE)\s/, '');
			str = str.replace(/^(WHERE\s)(IS|WAS|ARE|WERE)\s/, '');
			str = str.replace(/^(WHEN\s)(IS|WAS|ARE|WERE)\s/, '');
			str = str.replace(/^(WHY\s)(IS|WAS|ARE|WERE)\s/, '');
			str = str.replace(/^(HOW\s)(IS|WAS|ARE|WERE)\s/, '');

			/*	What did you eat? "pie".  Incorrect; the answer is "A pie".
				Where are you? "at work".  Incorrect; the answer is "Work".
				And so forth. */
			str = str.replace(/^A\s/, '');
			str = str.replace(/^AT\s/, '');
			str = str.replace(/^THE\s/, '');
			str = str.replace(/^IN\s/, '');

			/*	These could lead to some falsely right answers, but whatever. We
				won't cover every possible honorific, but there are some common
				ones that I don't think people should be penalized for omitting.
				Which English king liked to cut off his wives' heads?  "Henry
				VIII" Incorrect; the answer is "King Henry VIII"; yet "King" was
				in the question. etc. */
			str = str.replace(/(MR|MS|MRS|DR|CPT|CAPT)\.*\s/g, '');
			str = str.replace(
				/(MISTER|MISS|MISSUS|DOCTOR|KING|QUEEN|PRINCE|PRINCESS|CAPTAIN)\s/g,
				''
			);

			str = str.replace(/\sAND\s/g, '\s'); // & / AND
			str = str.replace(/[^\w|\s]/g, '');

			str = str.replace(/^\s+|\s+$/g, ''); // Trim

			return str;

		}

		var ret = false;

		/*	Some answers look like: (David) Bowie, to indicate an optional
			component. */
		var re = /\(.*\)/;
		var match = re.exec(answer2);
		if (match !== null) {
			/*	If the real answer has a bracketed component, we'll extract both
				words and see if either one matches. */
			var answer2a = answer2.replace(match[0], '');
			var answer2b = match[0].replace(/\(|\)/g, '');
			ret = (
				normalize(answer1) === normalize(answer2a) ||
				normalize(answer1) === normalize(answer2b)
			);
			/*	If neither word matched, we'll see if both strings match once
				you	strip away the brackets and normalize. */
			if (!ret) {
				var a1 = answer1.replace(/\(|\)/g, '');
				var a2 = answer2.replace(/\(|\)/g, '');
				ret = (normalize(a1) === normalize(a2));
			}
		}

		if (!ret) {
			var a1 = normalize(answer1);
			var a2 = normalize(answer2);
			ret = (a1 === a2);
			/*	However, if it's just a two word answer after normalization, and the
				second word of each answer matches, we'll give it to them.  This is
				another case where we may falsely identify a wrong answer as correct,
				but it will also catch a lot of cases where someone gave a correct
				surname but not a first name, and similar situations.  This is still
				questionable and I may remove it. */
			a1 = a1.split(' ');
			a2 = a2.split(' ');
			if (!ret) ret = (a1.length == 2 && a2.length === 2 && a1[1] === a2[1]);
			/*	If the player's answer has all of the same words as the real answer,
				but in a different order, just give it to them. */
			if (!ret && a1.length === a2.length) {
				ret = (
					a1.some(function (e) { return (a2.indexOf(e) < 0); })
					? false
					: true
				);
			}

		}

		return ret;
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
