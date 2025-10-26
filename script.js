let allEmployeeData = [];
let selectedEmployeeData = null; 
let isPivotVisible = false; 
let statusChartInstance = null; 
let currentFilteredPivotData = []; // Data filtered by pivot dropdowns

// NEW: Global state for the currently active grouping field
let currentGroupingField = 'Status'; 

// Credentials will be loaded here from user.json
let userCredentials = null; 
const LOGIN_STORAGE_KEY = 'gcc_dashboard_authenticated';
const USER_KEY = 'gcc_dashboard_user';

// Elements
const loginContainer = document.getElementById('loginContainer');
const dashboardContainer = document.getElementById('dashboardContainer');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('loginError');
const currentUserNameSpan = document.getElementById('currentUserName');

// Existing Elements
const CORE_FIELDS = [
    "GCC ID",
    "Associate First Name",
    "Associate Last Name",
    "Citizens Job Role",
    "Cognizant Level 1 - 5", 
    "Skills",
    "Status",
    "Source",
    "Reporting Manager"
];

// Mapping of friendly display name to actual data key - UPDATED WITH QUARTER
const PIVOT_FIELDS_MAP = {
    "Status": "Status",
    "Source": "Source",
    "Level": "Cognizant Level 1 - 5", 
    "Quarter": "Citizens Original Quarter" // Added Quarter mapping
};

const pivotStatusBody = document.getElementById('pivotStatusBody');
const pivotContainer = document.getElementById('summaryPivotContainer');
const toggleSummaryBtn = document.getElementById('toggleSummaryButton');
const sourceFilter = document.getElementById('sourceFilter'); 
const slFilter = document.getElementById('slFilter');         
const tsltMemberFilter = document.getElementById('tsltMemberFilter'); 
const quarterFilter = document.getElementById('quarterFilter');
const statusFilter = document.getElementById('statusFilter'); // ADDED STATUS FILTER
const summaryTableBody = document.getElementById('summaryTableBody');
const detailsTableBody = document.getElementById('detailsTableBody');
const detailsTitle = document.getElementById('detailsTitle');
const messageDiv = document.getElementById('message');
const querySummarySpan = document.getElementById('querySummary'); 
const downloadButton = document.getElementById('downloadCsvButton'); 
const fullDetailsLinkContainer = document.getElementById('fullDetailsLinkContainer');
const showFullDetailsLink = document.getElementById('showFullDetailsLink');

// NEW: Group By elements
const groupByButtons = document.getElementById('groupByButtons');
const pivotCategoryHeader = document.getElementById('pivotCategoryHeader');


const inputElements = {
    firstName: document.getElementById('firstNameInput'),
    lastName: document.getElementById('lastNameInput'),
    gccId: document.getElementById('gccIdInput'),
    skill: document.getElementById('skillInput'),
    source: document.getElementById('sourceInput')
};

// ----------------------------------------------------------------------
// --- AUTHENTICATION FUNCTIONS ---
// ----------------------------------------------------------------------

/**
 * Loads user credentials from the user.json file, converting all usernames to lowercase
 * and trimming all values for robust authentication.
 */
async function loadCredentials() {
    if (userCredentials) return; // Already loaded

    try {
        const response = await fetch('user.json');
        if (!response.ok) {
            // If response status is not successful (e.g., 404, 500)
            throw new Error(`Failed to load user.json: HTTP status ${response.status}`);
        }
        const data = await response.json();
        
        // Convert all keys (usernames) to lowercase for case-insensitive lookup
        const rawCredentials = data.users;
        userCredentials = {};
        
        for (const [key, value] of Object.entries(rawCredentials)) {
            // Store username as lowercase, and ensure stored password is trimmed
            userCredentials[key.toLowerCase()] = String(value).trim(); 
        }

    } catch (error) {
        console.error("Authentication file error:", error);
        if (loginError) {
            loginError.textContent = "Error: Could not load user credentials. Check user.json path/format.";
            loginError.style.display = 'block';
        }
        throw error; // Propagate error to stop login attempt
    }
}

function showDashboard(username) {
    if (loginContainer && dashboardContainer && currentUserNameSpan) {
        loginContainer.style.display = 'none';
        dashboardContainer.style.display = 'block';
        currentUserNameSpan.textContent = username; // Display the authenticated username
        // Now that the dashboard is visible, load the data
        loadData();
    }
}

/**
 * Handles the login attempt, loads credentials, and validates against all users.
 */
async function handleLogin() {
    // Trim input and convert username to lowercase for robust, case-insensitive check
    const user = usernameInput.value.trim(); 
    const userLower = user.toLowerCase();
    const pass = passwordInput.value.trim(); // Trim password input

    if (loginError) loginError.style.display = 'none';
    
    // 1. Load credentials (will only happen on first successful attempt)
    try {
        await loadCredentials(); 
    } catch {
        return; // Stop if loading failed (error already displayed)
    }
    
    // Check if the lowercase username exists and the trimmed password matches
    const storedPassword = userCredentials[userLower];

    if (storedPassword && storedPassword === pass) {
        localStorage.setItem(LOGIN_STORAGE_KEY, 'true');
        localStorage.setItem(USER_KEY, user); // Store original casing of username
        showDashboard(user);
    } else {
        if (loginError) {
            loginError.textContent = "Invalid username or password.";
            loginError.style.display = 'block';
        }
        // Clear password field only
        if (passwordInput) passwordInput.value = ''; 
        if (passwordInput) passwordInput.focus();
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
        localStorage.removeItem(LOGIN_STORAGE_KEY);
        localStorage.removeItem(USER_KEY);
        if (dashboardContainer) dashboardContainer.style.display = 'none';
        if (loginContainer) loginContainer.style.display = 'flex';
        // Clear inputs for next login attempt
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (usernameInput) usernameInput.focus();
    }
}

function checkAuthentication() {
    const isAuthenticated = localStorage.getItem(LOGIN_STORAGE_KEY) === 'true';
    const storedUser = localStorage.getItem(USER_KEY);
    
    if (isAuthenticated && storedUser) {
        showDashboard(storedUser);
    } else {
        if (loginContainer) loginContainer.style.display = 'flex';
        if (dashboardContainer) dashboardContainer.style.display = 'none';
    }
}

// ----------------------------------------------------------------------
// --- DASHBOARD FUNCTIONS ---
// ----------------------------------------------------------------------

function clearInputFields() {
    if (inputElements.firstName) inputElements.firstName.value = '';
    if (inputElements.lastName) inputElements.lastName.value = '';
    if (inputElements.gccId) inputElements.gccId.value = '';
    if (inputElements.skill) inputElements.skill.value = '';
    if (inputElements.source) inputElements.source.value = '';
}

// ADDED NULL CHECKS TO PREVENT "Cannot set properties of null" ERROR
function showInitialTableMessage() {
    if (summaryTableBody) summaryTableBody.innerHTML = '<tr><td colspan="6" class="empty-table-message">Enter search criteria and click \'Search GCCs\'.</td></tr>';
    if (detailsTableBody) detailsTableBody.innerHTML = '<tr><td colspan="2" class="empty-table-message">Full details will appear here after search.</td></tr>';
    if (detailsTitle) detailsTitle.textContent = 'Select a result above';
    if (querySummarySpan) querySummarySpan.textContent = '(No search performed)';
    selectedEmployeeData = null; 
    if (downloadButton) downloadButton.disabled = true; 
    if (fullDetailsLinkContainer) fullDetailsLinkContainer.style.display = 'none'; 
}

function populateFilters() {
    if (allEmployeeData.length === 0) return;

    const sourceKey = "Source";
    const slKey = "Cognizant Level 1 - 5";
    const tsltKey = "TSLT Member"; 
    const quarterKey = "Citizens Original Quarter"; 
    const statusKey = "Status"; // NEW STATUS KEY
    
    const sources = new Set();
    const slLevels = new Set();
    const tsltMembers = new Set();
    const quarters = new Set(); 
    const statuses = new Set(); // NEW STATUS SET

    allEmployeeData.forEach(emp => {
        if (emp[sourceKey]) sources.add(emp[sourceKey]);
        if (emp[slKey]) slLevels.add(emp[slKey]);
        if (emp[tsltKey]) tsltMembers.add(emp[tsltKey]);
        if (emp[quarterKey]) quarters.add(emp[quarterKey]); 
        if (emp[statusKey]) statuses.add(emp[statusKey]); // POPULATE STATUS SET
    });

    const sortedSources = Array.from(sources).sort();
    const sortedTsltMembers = Array.from(tsltMembers).sort();
    const sortedQuarters = Array.from(quarters).sort(); 
    const sortedStatuses = Array.from(statuses).sort(); // SORT STATUSES
    
    const sortedSlLevels = Array.from(slLevels).sort((a, b) => {
        const numA = parseFloat(a) || Infinity;
        const numB = parseFloat(b) || Infinity;
        return numA - numB;
    });

    // POPULATE STATUS FILTER
    if (statusFilter) {
        statusFilter.innerHTML = '<option value="">All Statuses</option>';
        sortedStatuses.forEach(status => {
            statusFilter.innerHTML += `<option value="${status}">${status}</option>`;
        });
    }
    
    if (sourceFilter) {
        sourceFilter.innerHTML = '<option value="">All Sources</option>';
        sortedSources.forEach(source => {
            sourceFilter.innerHTML += `<option value="${source}">${source}</option>`;
        });
    }

    if (slFilter) {
        slFilter.innerHTML = '<option value="">All Levels</option>';
        sortedSlLevels.forEach(sl => {
            slFilter.innerHTML += `<option value="${sl}">${sl}</option>`;
        });
    }

    if (tsltMemberFilter) {
        tsltMemberFilter.innerHTML = '<option value="">All TSLT</option>';
        sortedTsltMembers.forEach(tslt => {
            tsltMemberFilter.innerHTML += `<option value="${tslt}">${tslt}</option>`;
        });
    }
    
    // POPULATE QUARTER FILTER
    if (quarterFilter) {
        quarterFilter.innerHTML = '<option value="">All Quarters</option>';
        sortedQuarters.forEach(quarter => {
            quarterFilter.innerHTML += `<option value="${quarter}">${quarter}</option>`;
        });
    }
}


function toggleSummaryPivot() {
    if (allEmployeeData.length === 0) {
        alert("Data not yet loaded. Please wait.");
        return;
    }

    isPivotVisible = !isPivotVisible;
    if (pivotContainer) pivotContainer.style.display = isPivotVisible ? 'flex' : 'none';
    if (toggleSummaryBtn) toggleSummaryBtn.textContent = isPivotVisible ? 'Hide Summary' : 'Show Summary';

    if (isPivotVisible) {
        populateFilters(); 
        createDataPivot(); 
    }
}

function renderStatusChart(labels, data) {
    const ctx = document.getElementById('statusChart')?.getContext('2d');
    if (!ctx) return;
    
    if (statusChartInstance) {
        statusChartInstance.destroy();
    }

    // Define a color palette that matches the number of labels
    const colorPalette = [
        'rgba(5, 150, 105, 0.7)',  // Green
        'rgba(30, 58, 138, 0.7)',  // Blue
        'rgba(245, 158, 11, 0.7)', // Orange
        'rgba(220, 38, 38, 0.7)',  // Red
        'rgba(107, 114, 128, 0.7)',// Gray
        'rgba(147, 51, 234, 0.7)', // Purple
        'rgba(217, 119, 6, 0.7)',  // Dark Orange
        'rgba(4, 120, 87, 0.7)',   // Dark Green
        'rgba(59, 130, 246, 0.7)', // Light Blue
        'rgba(202, 138, 4, 0.7)'   // Dark Yellow
    ];

    // Map the labels to the colors
    const backgroundColors = labels.map((_, index) => colorPalette[index % colorPalette.length]);
    const borderColors = backgroundColors.map(color => color.replace('0.7', '1'));

    
    Chart.register(ChartDataLabels);
    statusChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Status Count',
                data: data,
                backgroundColor: backgroundColors, 
                borderColor: borderColors, 
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'x', 
            plugins: {
                legend: {
                    // LEGEND DISPLAY IS SET TO FALSE
                    display: false, 
                },
                title: {
                    display: true,
                    text: '' 
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#333',
                    font: {
                        weight: 'bold',
                        size: 10
                    },
                    formatter: (value) => {
                        return value > 0 ? value : '';
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        // SAFE ACCESS TO PIVOT CATEGORY HEADER
                        text: pivotCategoryHeader?.textContent || 'Category' 
                    },
                    ticks: {
                        autoSkip: false,
                        maxRotation: 15,
                        minRotation: 15
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Count' 
                    },
                    ticks: {
                        precision: 0
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

/**
 * NEW: Sets the active grouping field, updates button styles, and refreshes the pivot table.
 * @param {HTMLElement} element The anchor tag that was clicked.
 * @param {string} fieldName The field name (e.g., 'Status', 'Source', 'Level').
 */
function setGroupingField(element, fieldName) {
    // 1. Update the global state
    currentGroupingField = fieldName;
    
    // 2. Update button active classes
    if (groupByButtons) {
        const buttons = groupByButtons.querySelectorAll('a');
        buttons.forEach(btn => {
            btn.classList.remove('active');
        });
        element.classList.add('active');
    }
    
    // 3. Refresh the pivot table and chart
    createDataPivot();
}


function createDataPivot() {
    // Determine the data field to pivot on based on the global state
    const selectedGroupingKey = currentGroupingField; // e.g., "Status", "Source", "Level", "Quarter"
    const pivotField = PIVOT_FIELDS_MAP[selectedGroupingKey] || "Status"; // Default to Status
    
    // Update the table header text
    if (pivotCategoryHeader) pivotCategoryHeader.textContent = selectedGroupingKey;
    
    const sourceField = "Source";
    const slField = "Cognizant Level 1 - 5";
    const tsltField = "TSLT Member"; 
    const quarterField = "Citizens Original Quarter"; 
    const statusField = "Status"; // STATUS FIELD KEY
    
    const selectedSource = sourceFilter?.value;
    const selectedSL = slFilter?.value;
    const selectedTSLT = tsltMemberFilter?.value; 
    const selectedQuarter = quarterFilter?.value; 
    const selectedStatus = statusFilter?.value; // GET STATUS FILTER VALUE
    
    if (allEmployeeData.length === 0) {
        if (pivotStatusBody) pivotStatusBody.innerHTML = '<tr><td colspan="3">Data not loaded.</td></tr>';
        renderStatusChart(['N/A'], [0]); 
        currentFilteredPivotData = []; 
        return;
    }

    // 1. Filter the entire dataset based on the pivot filters
    let filteredData = allEmployeeData.filter(emp => {
        let passesSource = true;
        let passesSL = true;
        let passesTSLT = true; 
        let passesQuarter = true; 
        let passesStatus = true; // STATUS PASS CHECK

        if (selectedSource) {
            passesSource = emp[sourceField] === selectedSource;
        }

        if (selectedSL) {
            passesSL = emp[slField] === selectedSL;
        }
        
        if (selectedTSLT) {
            passesTSLT = emp[tsltField] === selectedTSLT;
        }
        
        // APPLY QUARTER FILTER
        if (selectedQuarter) {
            passesQuarter = emp[quarterField] === selectedQuarter;
        }
        
        // APPLY STATUS FILTER
        if (selectedStatus) {
            passesStatus = emp[statusField] === selectedStatus;
        }


        return passesSource && passesSL && passesTSLT && passesQuarter && passesStatus;
    });
    
    currentFilteredPivotData = filteredData; 
    
    const totalCount = filteredData.length;

    // 2. Count the occurrences of the selected pivot field
    const counts = filteredData.reduce((acc, emp) => {
        // Use the dynamic pivotField
        const key = emp[pivotField] || 'N/A'; 
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    // Sort by key (Status/Source/Level/Quarter name)
    const sortedCounts = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
    
    const chartLabels = sortedCounts.map(item => item[0]);
    const chartData = sortedCounts.map(item => item[1]);

    if (pivotStatusBody) pivotStatusBody.innerHTML = ''; 
    
    // 3. Populate the pivot table
    if (pivotStatusBody) {
        if (sortedCounts.length > 0) {
            sortedCounts.forEach(([key, count]) => {
                
                const percentage = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) + '%' : '0.0%';

                const row = pivotStatusBody.insertRow();
                row.insertCell().textContent = key;
                
                const countCell = row.insertCell();
                if (count > 0) {
                    const link = document.createElement('a');
                    link.href = '#';
                    link.textContent = count;
                    link.onclick = (e) => {
                        e.preventDefault();
                        // Pass the pivot field name and the value to the generic handler
                        openPivotDetailWindow(pivotField, key, selectedGroupingKey);
                    };
                    countCell.appendChild(link);
                } else {
                    countCell.textContent = count;
                }
                
                row.insertCell().textContent = percentage;

            });
        } else {
            pivotStatusBody.innerHTML = `<tr><td colspan="3">No data matches the selected filters.</td></tr>`;
        }
    }
    
    renderStatusChart(chartLabels, chartData);
}

// Renamed and generalized function to handle any pivot field
function openPivotDetailWindow(pivotFieldName, pivotValue, pivotDisplayGroup) {
    // The filtering logic uses the dynamic pivotFieldName
    const specificData = currentFilteredPivotData.filter(emp => emp[pivotFieldName] === pivotValue);

    if (specificData.length === 0) {
        alert(`No data found for ${pivotDisplayGroup}: ${pivotValue} under current filters.`);
        return;
    }

    displaySummary(specificData);

    const status = statusFilter?.value ? `Status: ${statusFilter.value}` : 'All Statuses'; // ADDED STATUS MESSAGE
    const source = sourceFilter?.value ? `Source: ${sourceFilter.value}` : 'All Sources';
    const sl = slFilter?.value ? `Level: ${slFilter.value}` : 'All Levels';
    const tslt = tsltMemberFilter?.value ? `TSLT: ${tsltMemberFilter.value}` : 'All TSLT';
    const quarter = quarterFilter?.value ? `Quarter: ${quarterFilter.value}` : 'All Quarters'; 
    
    // Use the pivotDisplayGroup in the message
    const coloredText = `<span style="font-weight: bold; color: #059669;">Filtered by ${pivotDisplayGroup}</span>`;
    
    if (querySummarySpan) querySummarySpan.innerHTML = `(${coloredText}: ${pivotValue} | Pivot Filters: ${status}, ${source}, ${sl}, ${tslt}, ${quarter})`; // UPDATED MESSAGE
    
    if (messageDiv) {
        messageDiv.textContent = `Displaying ${specificData.length} GCC(s) filtered by ${pivotDisplayGroup}: ${pivotValue}. Click a row for full details.`;
        messageDiv.className = 'success';
    }
    
    if (detailsTableBody) detailsTableBody.innerHTML = '<tr><td colspan="2" class="empty-table-message">Full details will appear here after selecting a filtered row.</td></tr>';
    if (detailsTitle) detailsTitle.textContent = 'Select a filtered result above';
    selectedEmployeeData = null; 
    if (downloadButton) downloadButton.disabled = true; 
    if (fullDetailsLinkContainer) fullDetailsLinkContainer.style.display = 'none'; 
}


async function loadData() {
    // ADDED NULL CHECK HERE TO PREVENT ERROR ON EARLY CALLS
    if (messageDiv) {
        messageDiv.textContent = 'Loading data...';
        messageDiv.className = 'error';
    }
    showInitialTableMessage();

    try {
        // NOTE: Assumes a db.json file is available in the same directory as index.html
        const response = await fetch('db.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        allEmployeeData = await response.json();
        
        if (allEmployeeData.length > 0) {
            if (messageDiv) {
                messageDiv.textContent = `Data for ${allEmployeeData.length} GCCs loaded successfully.`;
                messageDiv.className = 'success';
            }
            populateFilters(); 
            // Ensure pivot loads with 'Status' grouped initially if visible
            if (isPivotVisible) {
                 createDataPivot();
            }
        } else {
            if (messageDiv) {
                messageDiv.textContent = 'Data loaded, but the JSON file is empty.';
                messageDiv.className = 'error';
            }
        }

    } catch (error) {
        // ADDED NULL CHECK HERE TO PREVENT THE REPORTED ERROR FROM THE CATCH BLOCK
        if (messageDiv) {
            messageDiv.textContent = `Error loading db.json. Check file path or local server. Error: ${error.message}`;
            messageDiv.className = 'error';
        }
        console.error(error);
    }
}

function searchEmployee() {
    const searchTerms = {
        firstName: inputElements.firstName?.value.trim(),
        lastName: inputElements.lastName?.value.trim(),
        gccId: inputElements.gccId?.value.trim(),
        skill: inputElements.skill?.value.trim(),
        source: inputElements.source?.value.trim()
    };
    
    const searchTermsLower = Object.fromEntries(
        Object.entries(searchTerms).map(([key, value]) => [key, value?.toLowerCase() || ''])
    );

    const anyInput = Object.values(searchTerms).some(term => term && term.length > 0);
    
    if (summaryTableBody) summaryTableBody.innerHTML = '';
    if (detailsTableBody) detailsTableBody.innerHTML = '';
    if (detailsTitle) detailsTitle.textContent = 'Select a result above';
    if (messageDiv) {
        messageDiv.textContent = '';
        messageDiv.className = 'error';
    }
    if (downloadButton) downloadButton.disabled = true; 
    if (fullDetailsLinkContainer) fullDetailsLinkContainer.style.display = 'none';

    if (allEmployeeData.length === 0) {
        if (messageDiv) messageDiv.textContent = 'Data has not been loaded yet. Please wait or check data source.';
        return;
    }

    if (!anyInput) {
        if (messageDiv) messageDiv.textContent = 'Please enter at least one search criterion.';
        showInitialTableMessage();
        return;
    }
    
    const queryParts = [];
    if (searchTerms.gccId) queryParts.push(`ID: ${searchTerms.gccId}`);
    if (searchTerms.firstName) queryParts.push(`First Name: ${searchTerms.firstName}`);
    if (searchTerms.lastName) queryParts.push(`Last Name: ${searchTerms.lastName}`);
    if (searchTerms.skill) queryParts.push(`Skill: ${searchTerms.skill}`);
    if (searchTerms.source) queryParts.push(`Source: ${searchTerms.source}`);
    if (querySummarySpan) querySummarySpan.textContent = `(Search: ${queryParts.join(', ')})`;

    const foundEmployees = allEmployeeData.filter(emp => {
        let matches = true;
        
        if (searchTermsLower.gccId && emp["GCC ID"]?.toLowerCase() !== searchTermsLower.gccId) {
            matches = false;
        }
        
        if (matches && searchTermsLower.firstName && !emp["Associate First Name"]?.toLowerCase().includes(searchTermsLower.firstName)) {
            matches = false;
        }

        if (matches && searchTermsLower.lastName && !emp["Associate Last Name"]?.toLowerCase().includes(searchTermsLower.lastName)) {
            matches = false;
        }
        
        if (matches && searchTermsLower.skill && !emp["Specific Skill Requirements"]?.toLowerCase().includes(searchTermsLower.skill)) {
            matches = false;
        }
        
        if (matches && searchTermsLower.source && !emp["Source"]?.toLowerCase().includes(searchTermsLower.source)) {
            matches = false;
        }

        return matches;
    });

    if (foundEmployees.length > 0) {
        displaySummary(foundEmployees);
        displayDetails(foundEmployees[0]); 

        if (messageDiv) {
            messageDiv.textContent = `Found ${foundEmployees.length} GCC(s) matching the criteria. Click a row for full details.`;
            messageDiv.className = 'success';
        }
    } else {
        if (messageDiv) messageDiv.textContent = 'No GCCs found matching all criteria.';
        if (querySummarySpan) querySummarySpan.textContent = `(No results for: ${queryParts.join(', ')})`; 
        showInitialTableMessage();
    }
    
    clearInputFields();
}

function displaySummary(employees) {
    if (!summaryTableBody) return;
    summaryTableBody.innerHTML = '';

    employees.forEach(emp => {
        const row = summaryTableBody.insertRow();
        row.classList.add('summary-row');
        
        row.onclick = () => displayDetails(emp); 

        row.insertCell().textContent = emp["GCC ID"];

        const name = `${emp["Associate First Name"] || ''} ${emp["Associate Last Name"] || ''}`.trim() || 'N/A';
        row.insertCell().textContent = name;

        row.insertCell().textContent = emp["Citizens Job Role"] || 'N/A';
        
        row.insertCell().textContent = emp["Cognizant Level 1 - 5"] || 'N/A'; 

        const skillsCell = row.insertCell();
        skillsCell.textContent = emp["Specific Skill Requirements"] || 'N/A';
        if (skillsCell.textContent.length > 30) {
            skillsCell.textContent = skillsCell.textContent.substring(0, 30) + '...';
        }

        row.insertCell().textContent = emp["Status"] || 'N/A';
    });
}

function populateDetailsTable(employee, useAllFields) {
    if (!detailsTableBody) return;
    detailsTableBody.innerHTML = '';
    
    const fields = useAllFields ? Object.keys(employee).sort() : CORE_FIELDS;

    fields.forEach(key => {
        
        const row = detailsTableBody.insertRow();
        
        if (key === "Status") {
            row.classList.add('status-highlight');
        }
        
        const headerCell = row.insertCell();
        headerCell.textContent = key;
        headerCell.style.fontWeight = 'bold';
        
        const valueCell = row.insertCell();
        let value = employee[key];
        
        if (key === "Skills" && (!value || value === 'N/A')) {
             value = employee["Specific Skill Requirements"];
        }

        if (value === null || value === undefined || value === "") {
            valueCell.textContent = 'N/A';
            valueCell.style.fontStyle = 'italic';
        } else if (typeof value === 'number' && value > 1000000000000 && String(key).includes("Date")) {
            valueCell.textContent = new Date(value).toLocaleDateString();
        } else {
            valueCell.textContent = value;
        }
    });

    if (!useAllFields) {
        if (fullDetailsLinkContainer) fullDetailsLinkContainer.style.display = 'block';
        if (showFullDetailsLink) {
            showFullDetailsLink.textContent = 'Show full details';
            showFullDetailsLink.onclick = (e) => {
                e.preventDefault();
                populateDetailsTable(employee, true);
                if (fullDetailsLinkContainer) fullDetailsLinkContainer.style.display = 'none';
                if (messageDiv) {
                    messageDiv.textContent = `GCC ID : ${employee["GCC ID"]} - All details displayed.`;
                    messageDiv.className = 'success';
                }
            };
        }
    }
}

function displayDetails(employee) {
    selectedEmployeeData = employee; 
    if (downloadButton) downloadButton.disabled = false; 
    
    if (detailsTitle) detailsTitle.textContent = employee["GCC ID"] + ' - ' + (employee["Associate First Name"] || 'GCC');
    
    populateDetailsTable(employee, false);

    if (messageDiv) {
        messageDiv.textContent = `GCC ID : ${employee["GCC ID"]} details displayed (Core Fields). Click 'Show full details' below for all data.`;
        messageDiv.className = 'success';
    }
}

function downloadSelectedGccData() {
    if (!selectedEmployeeData) {
        alert("Please select a GCC ID result first.");
        return;
    }

    const employee = selectedEmployeeData;
    const filename = `GCC_${employee["GCC ID"]}_Details.csv`;

    const headers = [];
    const values = [];

    for (const key in employee) {
        if (employee.hasOwnProperty(key)) {
            headers.push(`"${String(key).replace(/"/g, '""').replace(/,/g, '')}"`);
            
            let value = employee[key];
            
            if (value === null || value === undefined) {
                value = 'N/A';
            } else if (typeof value === 'number' && value > 1000000000000 && String(key).includes("Date")) {
                value = new Date(value).toLocaleDateString();
            } else if (typeof value === 'string') {
                value = value.replace(/"/g, '""'); 
            }
            
            values.push(`"${value}"`);
        }
    }
    
    const csvContent = headers.join(',') + '\n' + values.join(',');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    
    if (link.download !== undefined) { 
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        if (document.body) document.body.appendChild(link);
        link.click();
        if (document.body) document.body.removeChild(link);
        URL.revokeObjectURL(url); 
    } else {
        alert("Download not supported by your browser. Please copy the data manually.");
    }
}

// NEW: Use DOMContentLoaded to ensure all HTML elements are loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
});