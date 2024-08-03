import FileUploader from './FileUploader';

// // Establish WebSocket connection
// const socket = new WebSocket('ws://10.20.18.109:5000');

// // Connection opened
// socket.addEventListener('open', function (event) {
//     console.log('WebSocket connection established');
// });

// // Listen for messages
// socket.addEventListener('message', function (event) {
//     console.log('Message from server ', event.data);
//     const data = JSON.parse(event.data);
//     if (data.progress) {
//         updateProgress(data.progress);
//     }
//     if (data.generation_details) {
//         updateGenerationDetails(data.generation_details);
//     }
// });

// function updateProgress(progress) {
//     // Update your progress bar or UI component here
//     console.log(`Progress: ${progress}%`);
// }

// function updateGenerationDetails(details) {
//     // Update your UI component with the generation details here
//     console.log('Generation Details:', details);
// }

function AccessibleAI() {
    return (
        <div>
            <h1>Accessible AI</h1>
            <FileUploader/>
        </div>
    )
}


export default AccessibleAI;