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
// const downloadFile = async () => {
//     console.log("Downloading file...");

//     try {
//         const linkToStorageFile = await getUrl({
//             path: "example-training-data/Breast_Cancer_Wisconcin_ds.csv",
//             options: {
//                 validateObjectExistence: true,  // Validate if the object exists
//                 expiresIn: 20,
//                 useAccelerateEndpoint: true,
//             },
//         });
//         console.log('result : ', linkToStorageFile);
//         console.log('signed URL: ', linkToStorageFile.url);
//         console.log('URL expires at: ', linkToStorageFile.expiresAt);
//     } catch (error) {
//         console.error('Error getting signed URL: ', error.message);
//         console.error('Error details: ', error);
//         if (error.code === 'NoSuchKey') {
//             console.error('The specified file does not exist.');
//         } else if (error.code === 'AccessDenied') {
//             console.error('Access denied. Check your permissions.');
//         } else {
//             console.error('An unexpected error occurred:', error);
//         }
//     }
// };

function AccessibleAI() {
    return (
        <div>
            <h1>Accessible AI</h1>
            <FileUploader/>
            {/* <Button onClick={downloadFile}>DOWNLOAD</Button> */}
        </div>
    )
}


export default AccessibleAI;