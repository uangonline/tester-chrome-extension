import { authenticate, setPollUrl, workStarted, workFinished } from '../actions';
import { logDebug } from '../logging';

const listenMessages = (store, chrome) => {
  const handleAuthMessage = ({
    worker_uuid: workerUUID,
    websocket_auth: socketAuth,
    work_available_endpoint: pollEndpoint,
  }) => {
    if (!workerUUID || !socketAuth) {
      throw new Error('Invalid authentication message received!');
    }

    const auth = {
      workerUUID,
      socketAuth,
    };
    store.dispatch(authenticate(auth));

    if (pollEndpoint) {
      const pollUrl = `${pollEndpoint}${workerUUID}/work_available`;
      store.dispatch(setPollUrl(pollUrl));
    }

    chrome.storage.sync.set({
      worker_uuid: workerUUID,
      websocket_auth: socketAuth,
      work_available_endpoint: pollEndpoint,
    });
  };

  const handleWorkError = () => {
    store.dispatch(workFinished());
  };

  const handleWorkStarted = () => {
    store.dispatch(workStarted());
  };

  // TODO: This is only here for backward compatibility; we should nuke once all
  // messages have been changed.
  const handleDataMessage = (data) => {
    if (data.worker_uuid && data.websocket_auth) {
      handleAuthMessage(data);
    }

    if (data.clear_work) {
      handleWorkError(data);
    }
  };

  const handleActionMessage = ({ type, payload }) => {
    switch (type) {
      case 'AUTHENTICATE':
        handleAuthMessage(payload);
        return 'ok';
      case 'WORK_ERROR':
        handleWorkError();
        return 'ok';
      case 'WORK_STARTED':
        handleWorkStarted();
        return 'ok';
      default:
        return 'unrecognized_message';
    }
  };

  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    logDebug('\n**Message received!**');
    logDebug('Message:', message);
    logDebug('Sender:', sender);

    if (message.data) {
      handleDataMessage(message.data);
      sendResponse('ok');
      return;
    }

    if (message.type) {
      const resp = handleActionMessage(message);
      sendResponse(resp);
      return;
    }

    sendResponse('no_data');
  });
};

export default listenMessages;
