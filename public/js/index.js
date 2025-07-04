document.addEventListener('DOMContentLoaded', () => {
	const ic = document.querySelector('.init-container');
	ic.requestFullScreen().catch((err) => {
		console.log('Could not enter FS mode');
	});
});
