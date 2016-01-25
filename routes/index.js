var express = require('express');
var router = express.Router();

/* GET home page. */
router.get(
	'/',
	function (req, res, next) {
		res.render('index', { title: 'Jeopardy API' });
	}
);

router.get(
	'/categories',
	function (req, res, next) {
		global.database.getCategoryIDs(
			function (ids) {
				res.json(ids);
			}
		);
	}
);

router.get(
	'/categories/:offset/:count',
	function (req, res, next) {
		global.database.getCategories(
			req.params.offset,
			req.params.count,
			function (categories) {
				res.json(categories);
			}
		);
	}
);

router.get(
	'/category/:id',
	function (req, res, next) {
		global.database.getCategory(
			req.params.id,
			function (category) {
				res.json(category);
			}
		);
	}
);

router.get(
	'/category/:id/:round',
	function (req, res, next) {
		global.database.getCategoryClues(
			req.params.id,
			req.params.round,
			function (clues) {
				res.json(clues);
			}
		);
	}
);

router.get(
	'/clues/random',
	function (req, res, next) {
		global.database.getRandomClue(
			function (clue) {
				res.json(clue);
			}
		);
	}
);

router.get(
	'/clues/:id',
	function (req, res, next) {
		global.database.getClue(
			req.params.id,
			function (clue) {
				res.json(clue);
			}
		);
	}
);

router.get(
	'/clues/:id/compare/:answer',
	function (req, res, next) {
		global.database.compareAnswer(
			req.params.id,
			req.params.answer,
			function (correct) {
				res.json({ correct : correct });
			}
		);
	}
);

module.exports = router;