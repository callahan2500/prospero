<script>
        document.addEventListener('DOMContentLoaded', function () {
            let currentStep = 1;

            let modal = document.getElementById('confirmationModal');
            let finalModal = document.getElementById('finalModal');
            let modalText = document.getElementById('modalText');
            let nextBtn = document.getElementById('nextBtn');

            // Assign event listeners for help-buttons and help-text
            var helpButtons = document.querySelectorAll('.help-button');
            helpButtons.forEach(function (button) {
                button.addEventListener('click', function () {
                    var helpInput = this.nextElementSibling;
                    helpInput.style.display = (helpInput.style.display === 'none') ? 'block' : 'none';
                });
            });

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

            const projectId = document.getElementById('project-id').value; // Assuming you have the project ID in a hidden input field

            const stepContainers = document.querySelectorAll('.step-container');
            const lastStepIndex = stepContainers.length;
            stepContainers.forEach((stepContainer, index) => {
            const stepNumber = index + 1;

            const button = stepNumber === lastStepIndex 
                ? stepContainer.querySelector('.submit-button') 
                : stepContainer.querySelector('.save-button');

                if (!button) {
                    console.error("Button not found for step container:", stepContainer);
                } else {
                    button.addEventListener('click', function() {
                        let allFilled = true;
                        stepContainer.querySelectorAll('input[type="url"]').forEach(input => {
                            if (!input.value.trim()) allFilled = false;
                        });

                        if (allFilled) {
                            // Collect data for all tasks in this step
                            const tasksData = [];
                            stepContainer.querySelectorAll('.task-item').forEach(taskItem => {
                                const taskData = {
                                    task_id: taskItem.dataset.taskId,  // Assuming you've stored the task_id in a data attribute on the taskItem
                                    taskInput: taskItem.querySelector('input[type="text"]').value
                                    // Add other necessary fields if needed
                                };
                                tasksData.push(taskData);
                            });

                            const payload = {
                                project_id: projectId,
                                tasks: tasksData
                            };

                            fetch('/submit_tasks', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(payload)
                            })


                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    if (stepNumber === lastStepIndex) {
                                        // This is the last step, show the finalModal
                                        finalModal.style.display = 'block';
                                    } else {
                                        let nextStep = stepNumber + 1;
                                        modalText.textContent = `You just completed Step ${stepNumber}. Now we're going to do ${nextStep}.`;
                                        modal.style.display = 'block';
                                    }
                                } else {
                                    alert("There was a problem saving your tasks. Please try again.");
                                }
                            })
                            .catch(error => {
                                console.error("Error submitting tasks:", error);
                                alert("There was a problem saving your tasks. Please try again.");
                            });
                        } else {
                            alert("Please fill all the fields before proceeding.");
                        }
                    });
                }
            });


            // Back Button Logic
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

            // Next Button Logic
            nextBtn.addEventListener('click', function () {
                modal.style.display = 'none';
                let stepContainer = document.querySelector(`#step${currentStep}-container`);
                stepContainer.style.display = 'none';
                currentStep++;
                document.querySelector(`#step${currentStep}-container`).style.display = 'block';
            });
        });


    </script>
