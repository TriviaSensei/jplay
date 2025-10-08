const timer = document.querySelector('.timer');
const initTime = 300;

const getTimeString = (time) => {
	const min = Math.floor(time / 60);
	const sec = time % 60;
	return `${min}:${sec >= 10 ? sec : `0${sec}`}`;
};

document.addEventListener('DOMContentLoaded', () => {
	let timeLeft = initTime;
	let timerInterval = null;
	const decrementTimer = () => {
		timeLeft = Math.max(0, timeLeft - 1);
		timer.innerHTML = getTimeString(timeLeft);
		if (timeLeft === 0) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	};
	timer.addEventListener(
		'click',
		() => {
			timerInterval = setInterval(decrementTimer, 1000);
		},
		{ once: true }
	);
});
