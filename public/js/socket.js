//Client-side socket handler
import { withTimeout } from './utils/socketTimeout.js';
import { showMessage } from './utils/messages.js';

let clientId;
document.addEventListener('DOMContentLoaded', () => {
	const socket = io();

	socket.once('ack-connection', () => {
		//see if a client id is stored in local storage
		const myId = localStorage.getItem('jp-client-id');
		//if not, get one and store it
		if (!myId) {
			socket.emit(
				'request-id',
				null,
				withTimeout(
					(data) => {
						if (data.status !== 'OK') showMessage('error', data.message);
						if (data.id) {
							localStorage.setItem('jp-client-id', data.id);
							clientId = data.id;
						}
					},
					() => {
						showMessage('error', 'Could not connect to server');
					}
				)
			);
		}
		//if so, send it to get our state back
		else {
			socket.emit(
				'verify-id',
				{ id: myId },
				withTimeout(
					(data) => {
						if (data.status !== 'OK') showMessage('error', data.message);
						if (data.id) {
							localStorage.setItem('jp-client-id', data.id);
							clientId = data.id;
						}
					},
					() => {
						showMessage('error', 'Could not connect to server');
					}
				)
			);
		}
	});

	document.addEventListener('emit-event', (e) => {
		console.log(e);
		socket.emit(
			e.detail.eventName,
			e.detail.data,
			e.detail.timeout ||
				withTimeout(
					(data) => {
						if (data.status !== 'OK') return showMessage('error', data.message);
					},
					() => {
						showMessage('error', `${e.detail.eventName} timed out`);
					}
				)
		);
	});
});
