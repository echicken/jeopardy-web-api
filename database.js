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

}
util.inherits(Database, events.EventEmitter);

module.exports = Database;
