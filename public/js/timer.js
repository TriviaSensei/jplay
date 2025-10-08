const timer = document.querySelector('.timer');
const music = document.querySelector('#think-sound');

const initTime = 300;

const getTimeString = (time) => {
	const min = Math.floor(time / 60);
	const sec = time % 60;
	return `${min}:${sec >= 10 ? sec : `0${sec}`}`;
};

document.addEventListener('DOMContentLoaded', () => {
	let timeLeft = initTime;
	let timerInterval = null;
	let soundPlaying = false;
	const decrementTimer = () => {
		timeLeft = Math.max(-1, timeLeft - 1);
		if (timeLeft === -1) {
			clearInterval(timerInterval);
			timerInterval = null;
			return (timer.innerHTML = 'Soon!');
		} else if (timeLeft === 30 && !soundPlaying) {
			soundPlaying = true;
			music.play();
		}
		timer.innerHTML = getTimeString(timeLeft);
	};
	timer.addEventListener(
		'click',
		() => {
			timerInterval = setInterval(decrementTimer, 1000);
		},
		{ once: true }
	);
});
