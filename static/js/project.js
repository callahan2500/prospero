const projectId = document.getElementById('project-id').value; //Project ID
const projectTemplateId = document.getElementById('project-template-id').value; //Project Template ID
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


// Sends Help input to /ask and then returns & presents response
function handleHelpTextInputs() {
    var inputs = document.querySelectorAll('.help-text');
    inputs.forEach(function (input) {
        input.addEventListener('change', function () {
            var question = this.value;

            fetch('/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: question,
                    project_template_id: projectId, // You pass the project ID, not the template directly
                    
                }),
            })
            .then(response => response.json())
            .then(data => {
                console.log("Received Data:", data);
                var answerElement = document.createElement('p');
                answerElement.textContent = data.answer || data.error;
                input.parentNode.appendChild(answerElement); // Append the answer after the input
            })
            .catch(error => console.error(error));
        });
    });
}


function sanitizeInput(input) {
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: ['iframe'], ADD_ATTR: ['allowfullscreen'] });
}

// This function assumes you've added the 'loader' span within the 'submit-button' in your HTML
function showLoadingAnimation() {
    const submitButton = document.querySelector('.submit-button');
    const loader = submitButton.querySelector('.loader');

    // Add a visual cue like a spinner or loading animation to the loader container
    loader.classList.add('is-loading');
    // Optionally you could disable the submit button to prevent multiple submissions
    submitButton.disabled = true;
}

function hideLoadingAnimation() {
    const submitButton = document.querySelector('.submit-button');
    const loader = submitButton.querySelector('.loader');

    // Remove the visual cue
    loader.classList.remove('is-loading');
    // Re-enable the submit button
    submitButton.disabled = false;
}


function handleSubmitOrNextButtonClick() {
    stepContainers.forEach((stepContainer, index) => {
        const stepNumber = index + 1;
        const isLastStep = stepNumber === lastStepIndex;
        const buttonSelector = isLastStep ? '.submit-button' : '.save-button';
        const button = stepContainer.querySelector(buttonSelector);

        if(!button){
            console.error('Button not found for step:', stepNumber);
            return;
        }

        button.addEventListener('click', async function() {
            if (!validateStep(stepContainer)) {
                alert('Please fill out all tasks before proceeding');
                return;
            }

        const formData = constructFormData(stepContainer);

        showLoadingAnimation();

        try {
            await submitTasks(formData);

            if (!isLastStep){
                confirmNextStep(stepNumber);
                hideLoadingAnimation();
            } else {
                await makeProjectPublic(projectId);
                hideLoadingAnimation();
                finalModal.style.display = 'block';
            }
        } catch (error){
            console.error('Error', error);
            alert(error.message || 'Hm, something went wrong. Please try again later');
        }

        });

    });
}


function validateStep(stepContainer) {
    let allFilled = true;
    const tasksData = [];
    stepContainer.querySelectorAll('.task-item').forEach(taskItem => {
        const taskType = taskItem.getAttribute('data-inputType');
        const taskId = taskItem.dataset.taskId;

        if (taskType === 'text') {
            const taskInput = taskItem.querySelector('textarea');
            if (!taskInput.value.trim()) {
                allFilled = false;
                return;
            }
            tasksData.push({
                task_id: taskId,
                taskInput: taskInput.value
            });

        } else if (taskType === 'file') {
            const fileInput = taskItem.querySelector('input[type="file"]');
            if(fileInput.getAttribute('data-uploaded')==='true'){
                console.log('File already uploaded mate');
            } else{
                if(!fileInput.files.length){
                    console.log("No file chosen for task",taskId);
                    allFilled = false;
                    return;
                }

                tasksData.push({
                    task_id: taskId,
                    taskFile: fileInput.files[0]
                });
                
            }
        }
    });
    return allFilled;
}

function constructFormData(stepContainer) {
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('project_template_id', projectTemplateId);
    const problemStatement = document.getElementById('problem-statement-input');
    formData.append('problem_statement', problemStatement.value);

    stepContainer.querySelectorAll('.task-item').forEach(taskItem => {
        const taskId = taskItem.dataset.taskId;
        const taskType = taskItem.getAttribute('data-inputType');

        if (taskType === 'text') {
            const taskInput = taskItem.querySelector('textarea');
            const sanitizedValue = taskInput.value;
            formData.append(`taskInput${taskId}`, sanitizedValue);
        } else if (taskType === 'file') {
            const fileInput = taskItem.querySelector('input[type="file"]');
            if (fileInput.getAttribute('data-uploaded') !== 'true') {
                formData.append(`taskFile${taskId}`, fileInput.files[0]);
            }
        }
    });

    return formData;
}

async function submitTasks(formData) {
    const response = await fetch('/submit_tasks', {
        method: 'POST',
        body: formData
    });
    if (!response.ok) {
        throw new Error('Failed to submit tasks. Please try again later.');
    }

    const data = await response.json();
    if (!data.success) {
        throw new Error('There was a problem saving your tasks. Please try again.');
    }

    return data;
}

function confirmNextStep(stepNumber) {
    let nextStep = stepNumber + 1;
    modalText.textContent = `You just completed Step ${stepNumber}. Now we're going to do ${nextStep}.`;
    modal.style.display = 'block';
}


async function makeProjectPublic(projectId) {
    const response = await fetch('/make_project_public', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ project_id: projectId })
    });
    if (!response.ok) {
        throw new Error('Failed to publish the project. Try again later.');
    }
    return response.json();
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
                    const sanitizedValue = taskInput.value;


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
            formData.append('project_template_id', projectTemplateId);
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
    showLoadingAnimation();
    hideLoadingAnimation();
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



