import { getElementArray } from './getElementArray.js';

// const view = 'game-board';
const view = 'live-clue-display';
const pos = 0;

const cats = getElementArray(document, '.game-board .category-div');
const scrollCats = getElementArray(document, '.category-scroll .category-div');
const clues = getElementArray(document, '.clue-value');
const lcd = document.querySelector('.live-clue-display');
const cd = lcd.querySelector('.category-text');
const vd = lcd.querySelector('.value-text');
const clueDisp = lcd.querySelector('.clue-text');
const fjWager = document.querySelector('.fj-wager-display .display-inner');
const fjResponse = document.querySelector(
	'.fj-response-display .display-inner',
);
document.addEventListener('DOMContentLoaded', () => {
	const handleCats = (c, i) => {
		c.parentElement.classList.remove('category-hidden');
		if (i === 0) {
			c.innerHTML = `Category ${i} is longer than the rest`;
			c.parentElement.classList.add('long-cat');
		} else c.innerHTML = `Category ${i}`;
	};
	cats.forEach(handleCats);
	scrollCats.forEach(handleCats);

	clues.forEach((c) => {
		const r = Number(c.getAttribute('data-row'));
		const val = 200 * (r + 1);
		c.innerHTML = val;
	});

	const divs = getElementArray(document, '.board-container > div');
	divs.forEach((d) => {
		if (d.classList.contains(view)) {
			d.classList.remove('d-none');
			if (view === 'category-scroll-container') {
				d.querySelector('.category-scroll').setAttribute(
					'style',
					`left: -${100 * pos}%;`,
				);
			}
		} else d.classList.add('d-none');
	});

	clueDisp.innerHTML =
		'IN 2016, P.M. NARENDRA MODI SAID THAT NOTES WORTH 500 AND 1000 OF THIS CURRENCY WOULD BE DEMONITIZED TO CURB COUNTERFEITING. This clue is really really really really really long.'.toUpperCase();
	vd.innerHTML = `1000`;
	cd.innerHTML = 'ROSEBUD';

	fjWager.innerHTML = '10,000';
	fjResponse.innerHTML = 'What is the wasteland?';
});
