function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = ""; // Clear the inline display style
        tabcontent[i].classList.remove("active"); // Remove the active class
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }
    document.getElementById(tabName).style.display = ""; // Clear the inline display style
    document.getElementById(tabName).classList.add("active"); // Add the active class to the current tab
    evt.currentTarget.classList.add("active");
}

if (document.getElementsByClassName("tablinks").length > 0) {
    document.getElementsByClassName("tablinks")[0].click();
}

function loadProject(projectId) {
    // Redirect to the project page using the Flask URL for loading projects
    window.location.href = `/load_project?project=${projectId}`;
}

function viewCaseStudy(projectId) {
    // Redirect to the case study page
    window.location.href = `/result/${projectId}`;
}