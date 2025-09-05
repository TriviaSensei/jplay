document.addEventListener('DOMContentLoaded', () => {
	const images = Array.from(document.querySelectorAll('.help-img'), (x) => x);
	images.forEach((img, i) => {
		img.setAttribute('src', `/img/help/${i + 1}.png`);
	});
});
