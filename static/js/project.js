const projectId = document.getElementById('project-id').value; //Project ID
const stepContainers = document.querySelectorAll('.step-container'); //Step Container
const lastStepIndex = stepContainers.length; //Which step we're one
const modal = document.getElementById('confirmationModal'); //Confirmation Modal
const finalModal = document.getElementById('finalModal'); //Final Modal before sending user to case study
const modalText = document.getElementById('modalText'); //Modal Text
const nextBtn = document.getElementById('nextBtn'); //Next Button

let currentStep = 1;

//Listens for user to click the "Ask AI for Help" btn//
function handleHelpButtons() {
    var helpButtons = document.querySelectorAll('.help-button');
    helpButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            // Navigate up to the parent step-container and then find the .help-section
            var helpInput = this.closest('.step-container').querySelector('.help-section');
            helpInput.style.display = (helpInput.style.display === 'none' || helpInput.style.display === '') ? 'block' : 'none';
        });
    });
}


//Sends Help input to /ask and then returns & presents response//
function handleHelpTextInputs() {
    var inputs = document.querySelectorAll('.help-text');
    inputs.forEach(function (input) {
        input.addEventListener('change', function () {
            var question = this.value;
            var projectBriefElement = document.querySelector('.container:nth-of-type(1) p');
            var objectiveElement = document.querySelector('.container:nth-of-type(2) p');
            var projectBrief = projectBriefElement ? projectBriefElement.textContent : '';
            var objective = objectiveElement ? objectiveElement.textContent : '';

            fetch('/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: question,
                    projectBrief: projectBrief,
                    objective: objective,
                }),
            })
            .then(response => response.json())
            .then(data => {
                console.log("Received Data:", data);
                var answer = document.createElement('p');
                answer.textContent = data.answer || data.error;
                this.parentNode.appendChild(answer);
            })
            .catch(error => console.error(error));
        });
    });
}

function sanitizeInput(input) {
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: ['iframe'], ADD_ATTR: ['allowfullscreen'] });
}


//Handles saving user input data and retrieving it.
function handleSubmitOrNextButtonClick() {
    stepContainers.forEach((stepContainer, index) => {
        const stepNumber = index + 1;
        const button = stepNumber === lastStepIndex 
            ? stepContainer.querySelector('.submit-button') 
            : stepContainer.querySelector('.save-button');

        if (!button) {
            console.error("Button not found for step:", stepContainer);
            return;
        }

        button.addEventListener('click', function() {
            let allFilled = true;
            const tasksData = [];
            var problemStatement = document.getElementById('problem-statement-input');


            stepContainer.querySelectorAll('.task-item').forEach(taskItem => {
                const taskType = taskItem.getAttribute('data-inputType');
                //const taskType = taskItem.dataset.inputType;
                const taskId = taskItem.dataset.taskId;
                console.log("Task type for task ID" ,taskId, ":", taskType);
                console.log("Task Type:", taskType);
                console.log("Task ID:", taskId);

                if (taskType === 'text') {
                    const taskInput = taskItem.querySelector('textarea');
                    if (!taskInput.value.trim()) {
                        allFilled = false;
                        return;  // exit this iteration of the loop
                    }
                    const sanitizedValue = sanitizeInput(taskInput.value);
                    
                    tasksData.push({
                        task_id: taskId,
                        taskInput: sanitizedValue //Use the santized value instead
                    });
                } else if (taskType === 'file') {
                    const fileInput = taskItem.querySelector('input[type="file"]');
                    if(fileInput.getAttribute('data-uploaded')==='true'){
                        console.log('File already uploaded for task ${taskId}');
                    } else{
                        if (!fileInput.files.length) {
                            console.log("No file chosen for task:", taskId);  // Log this
                            allFilled = false;
                            return;  // exit this iteration of the loop
                        }
                        // Storing the File object for now, we'll handle it during the fetch call
                        tasksData.push({
                            task_id: taskId,
                            taskFile: fileInput.files[0]
                        });
                    }
                }
            });

            if (!allFilled) {
                alert("Please fill all the fields or upload the necessary files before proceeding.");
                return;
            }

            const formData = new FormData();
            formData.append('project_id', projectId);
            formData.append('problem_statement', problemStatement.value);
            console.log("Task Data", tasksData);
            tasksData.forEach(taskData => {
                if (taskData.taskInput) {
                    formData.append(`taskInput${taskData.task_id}`, taskData.taskInput);
                } else if (taskData.taskFile) {
                    formData.append(`taskFile${taskData.task_id}`, taskData.taskFile);
                }
            });

            console.log("Form Data Entries:", [...formData.entries()]);


            fetch('/submit_tasks', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (stepNumber === lastStepIndex) {
                        return fetch('/make_project_public', {
                            method: 'POST',
                            headers:{
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({project_id: projectId})
                        })
                        .then(response =>response.json())
                        .then(data => {
                            if (data.success){
                                //Show the final modal only after the project is made public
                                finalModal.style.display = 'block';
                            } else {
                                throw new Error("Failed to Publish Project. Try Again Later.");
                            }
                        })

                        .catch(error => {
                            console.error("Error publishing project", error);
                            alert("We were unable to publish your project. Please try again");
                        });

                    } else {
                        let nextStep = stepNumber + 1;
                        modalText.textContent = `You just completed Step ${stepNumber}. Now we're going to do ${nextStep}.`;
                        modal.style.display = 'block';
                        return Promise.resolve({success: true});
                    }
                } else {
                    alert("There was a problem saving your tasks. Please try again.");
                }
            })


            .catch(error => {
                console.error("Error submitting tasks:", error);
                alert("There was a problem saving your tasks. Please try again.");
            });
        });
    });
}


function handleSaveButtonClick(){
    stepContainers.forEach((stepContainer, index) => {

        const button = stepContainer.querySelector('.only-save-button');

        if (!button) {
            console.error("Button not found for step container:", stepContainer);
            return;
        }

        button.addEventListener('click', function() {
            const tasksData = [];
            var problemStatement = document.getElementById('problem-statement-input');

            stepContainer.querySelectorAll('.task-item').forEach(taskItem => {
                const taskType = taskItem.getAttribute('data-inputType');
                //const taskType = taskItem.dataset.inputType;
                const taskId = taskItem.dataset.taskId;

                if (taskType === 'text') {
                    const taskInput = taskItem.querySelector('textarea');
                    if (!taskInput.value.trim()) {
                        allFilled = false;
                        return;  // exit this iteration of the loop
                    }
                    const sanitizedValue = sanitizeInput(taskInput.value);


                    tasksData.push({
                        task_id: taskId,
                        taskInput: sanitizedValue
                    });
                } else if (taskType === 'file') {
                    const fileInput = taskItem.querySelector('input[type="file"]');
                    //check if a file has been previously uploaded using data-uploaded attribute
                    if (fileInput.getAttribute('data-uploaded')==='true'){
                        console.log('File has already been uploaded for task ${taskID}');
                    } else {

                        if (!fileInput.files.length) {
                            console.log("No file chosen for task:", taskId);  // Log this
                            allFilled = false;
                            return;  // exit this iteration of the loop
                        }
                        // Storing the File object for now, we'll handle it during the fetch call
                        tasksData.push({
                            task_id: taskId,
                            taskFile: fileInput.files[0]
                        });
                    }
                }
            });

            const formData = new FormData();
            formData.append('project_id', projectId);
            formData.append('problem_statement', problemStatement.value);
            console.log("Task Data", tasksData);
            console.log("Problem Statement", problemStatement);
            tasksData.forEach(taskData => {
                if (taskData.taskInput) {
                    formData.append(`taskInput${taskData.task_id}`, taskData.taskInput);
                } else if (taskData.taskFile) {
                    formData.append(`taskFile${taskData.task_id}`, taskData.taskFile);
                }
            });


            fetch('/submit_tasks', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert("Saved")

                } else {
                    alert("There was a problem saving your tasks. Please try again.");
                }
            })
            .catch(error => {
                console.error("Error submitting tasks:", error);
                alert("There was a problem saving your tasks. Please try again.");
            });
        });
    });

}
//Handles back button
function handleBackButtonClick(){
    for (let i = 2; i <= 6; i++) {
        const backButton = document.querySelector(`#step${i}-container .back-button`);
        if (backButton) {
            backButton.addEventListener('click', function () {
                document.querySelector(`#step${i}-container`).style.display = 'none';
                currentStep--;
                document.querySelector(`#step${currentStep}-container`).style.display = 'block';
            });
        }
    }

}

//Handles Next Button [DEPRECATED]
function handleNextButtonClick(){
    nextBtn.addEventListener('click', function () {
        modal.style.display = 'none';
        let stepContainer = document.querySelector(`#step${currentStep}-container`);
        stepContainer.style.display = 'none';
        currentStep++;
        document.querySelector(`#step${currentStep}-container`).style.display = 'block';
    });

}

function handleFileUploadIcon(){
    const fileInputs = document.querySelectorAll('.file-upload-wrapper input[type="file"]');

    fileInputs.forEach(input => {
        input.addEventListener('change', function() {
            const fileName = this.files[0].name;
            const container = this.nextElementSibling;
            container.querySelector('.upload-icon').textContent = '✅'; // Green checkmark
            container.querySelector('.file-name').textContent = fileName;
        });
    });

}

function setupEventListeners(){
    handleHelpButtons();
    handleHelpTextInputs();
    sanitizeInput();
    handleSubmitOrNextButtonClick();
    handleSaveButtonClick();
    handleBackButtonClick();
    handleFileUploadIcon();

    nextBtn.addEventListener('click', function () {
        modal.style.display = 'none';
        let stepContainer = document.querySelector(`#step${currentStep}-container`);
        stepContainer.style.display = 'none';
        currentStep++;
        document.querySelector(`#step${currentStep}-container`).style.display = 'block';
    });

}

document.addEventListener('DOMContentLoaded', setupEventListeners);



