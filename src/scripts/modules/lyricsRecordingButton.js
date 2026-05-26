const recordingButtonText = {
    idle: 'RECORD',
    active: 'RECORDING...',
};

export const lyricsSetRecordingButtonState = (buttonElement, isRecording) => {
    buttonElement.disabled = isRecording;
    buttonElement.textContent = isRecording ? recordingButtonText.active : recordingButtonText.idle;
};
