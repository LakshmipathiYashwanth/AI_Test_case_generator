/**
 * Google Apps Script for generating test cases using the Gemini API.
 * Displays a UI for entering test scenarios, calls the API,
 * processes the response, and writes test cases to the active sheet.
 *
 * Requires:
 * 1. An HTML file named 'TestScenarioForm.html' in the same project.
 * 2. An API key for the Gemini API set in Script Properties (File > Project Properties > Script Properties) with the key name "API_KEY".
 */

// ====================================================================
// UI Functions
// ====================================================================

/**
 * Displays the modal dialog containing the HTML form.
 */
function showDialog() {
  try {
    var html = HtmlService.createHtmlOutputFromFile('TestScenarioForm')
        .setWidth(400)
        .setHeight(350); // Slightly increased height for better layout
    SpreadsheetApp.getUi()
        .showModalDialog(html, 'Test Case Generator');
  } catch (e) {
    // Log error and show an alert if the dialog fails to display
    Logger.log("Error in showDialog: " + e.toString() + "\nStack: " + e.stack);
    SpreadsheetApp.getUi().alert("Error displaying dialog. Please ensure 'TestScenarioForm.html' exists in the script project. Details: " + e.message);
  }
}

/**
 * Creates a custom menu in the spreadsheet when it's opened.
 * This is a simple trigger that runs automatically.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Test Generator')
      .addItem('Enter Test Scenarios', 'showDialog')
      .addToUi();
}

/**
 * Function designed to be called from a Google Sheets Macro
 * to open the test scenario dialog.
 * @OnlyCurrentDoc Limits the script to only affect the current document.
 */
function launchinputform() {
  showDialog();
};


// ====================================================================
// Core Test Case Generation Logic
// ====================================================================

/**
 * Fetches test cases from the Gemini API based on user-provided scenarios
 * and populates the active spreadsheet. Called from the HTML UI.
 *
 * @param {string[]} testScenarios An array of test scenario strings entered by the user.
 * @return {string} A status message indicating success or failure, displayed in the UI.
 */
function generateTestCasesFromUI(testScenarios) {
  Logger.log("generateTestCasesFromUI invoked with " + (testScenarios ? testScenarios.length : 0) + " scenarios.");

  var scriptProperties = PropertiesService.getScriptProperties();
  var apiKey = scriptProperties.getProperty("API_KEY");

  // --- Input Validation ---
  if (!apiKey) {
    Logger.log("API key is missing from Script Properties.");
    return "ERROR: API key is missing. Please set it in Script Properties (File > Project Properties > Script Properties).";
  }
  Logger.log("API Key Found (Starts with: " + apiKey.substring(0, 4) + "...)");

  if (!testScenarios || !Array.isArray(testScenarios) || testScenarios.length === 0) {
    Logger.log("No valid test scenarios array provided.");
    return "ERROR: No test scenarios were provided.";
  }
  testScenarios = testScenarios.filter(function(scenario) { return typeof scenario === 'string' && scenario.trim() !== ""; });
  if (testScenarios.length === 0) {
     Logger.log("All provided scenarios were empty after trimming.");
     return "ERROR: Please enter at least one valid test scenario.";
  }

  // --- Initialization ---
  var sheet;
  try {
      sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      Logger.log("Target sheet identified: '" + sheet.getName() + "' in spreadsheet '" + sheet.getParent().getName() + "'");
  } catch (e) {
      Logger.log("Error getting active sheet: " + e.message);
      return "ERROR: Could not access the active spreadsheet. Please ensure a sheet is open.";
  }

  var allTestCases = [];
  var totalScenarios = testScenarios.length;
  var scenariosProcessed = 0;

  // --- Process Each Scenario ---
  for (var i = 0; i < totalScenarios; i++) {
    var testScenario = testScenarios[i].trim();

    Logger.log("Processing scenario " + (i + 1) + "/" + totalScenarios + ": '" + testScenario + "'");

    // --- Construct API Request ---
    var prompt = "Generate test cases based on software testing principles (like Equivalence Partitioning and Boundary Value Analysis) for the following scenario: '" + testScenario + "'. " +
                 "Provide the output *only* as a valid JSON array, without any introductory text, explanations, or markdown formatting outside the JSON structure itself. " +
                 "The JSON array should contain objects, each representing a test case with these exact keys: " +
                 "'testCaseId' (string, e.g., 'TC_001'), 'description' (string), 'testData' (object), 'expectedResult' (string), 'actualResult' (string, initially empty), 'severity' (string, initially empty), 'priority' (string, initially empty).";


    var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey;

    var payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    };

    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      validateHttpsCertificates: true
    };

    // --- API Call and Response Handling ---
    try {
      Logger.log("Making API call for scenario " + (i + 1) + "...");
      var response = UrlFetchApp.fetch(url, options);
      var responseCode = response.getResponseCode();
      var responseText = response.getContentText();

      Logger.log("Raw Response [" + responseCode + "] for scenario " + (i + 1) + ":\n" + responseText);

      // --- Handle API Errors ---
      if (responseCode >= 400) {
        Logger.log("API Error encountered for scenario " + (i + 1) + ": HTTP Status Code " + responseCode);
        var errorDetails = responseText;
        try {
          var errorJson = JSON.parse(responseText);
          if (errorJson.error && errorJson.error.message) errorDetails = errorJson.error.message;
          Logger.log("Parsed API Error details: " + errorDetails);
        } catch (parseError) { Logger.log("Could not parse API error response as JSON."); }
        return "API Error for scenario " + (i + 1) + " (" + responseCode + "). Details: " + errorDetails;
      }

      // --- Process Successful Response ---
      var jsonResponse = JSON.parse(responseText);

      if (!jsonResponse.candidates || !Array.isArray(jsonResponse.candidates) || jsonResponse.candidates.length === 0 ||
          !jsonResponse.candidates[0].content || !jsonResponse.candidates[0].content.parts || !Array.isArray(jsonResponse.candidates[0].content.parts) ||
          jsonResponse.candidates[0].content.parts.length === 0 || !jsonResponse.candidates[0].content.parts[0].text) {
        Logger.log("API response structure invalid or missing expected text content for scenario " + (i + 1));
        continue; // Skip
      }

      var rawText = jsonResponse.candidates[0].content.parts[0].text;

      // --- Clean and Pre-process the Extracted Text ---
      var cleanedText = rawText.replace(/^```(?:json)?\s*|```\s*$/gm, "").trim();
      Logger.log("Cleaned Text (before .repeat fix) for scenario " + (i + 1) + ":\n" + cleanedText);

      // ****** Fix the ".repeat()" calls BEFORE JSON.parse ******
      try {
          cleanedText = cleanedText.replace(/"([a-zA-Z0-9])"\.repeat\((\d+)\)/g, function(match, char, count) {
              let repeatCount = parseInt(count, 10);
              if (isNaN(repeatCount) || repeatCount < 0) return match; // Basic validation
              // Limit repeat count to prevent excessive memory/string length issues
              const MAX_REPEAT = 1000; // Adjust as needed
              if (repeatCount > MAX_REPEAT) {
                  Logger.log("Warning: .repeat(" + count + ") exceeds MAX_REPEAT limit ("+MAX_REPEAT+"). Truncating for safety.");
                  repeatCount = MAX_REPEAT;
              }
              Logger.log("Replacing " + match + " with string of length " + repeatCount);
              return '"' + char.repeat(repeatCount) + '"'; // Return valid JSON string
          });
           Logger.log("Cleaned Text (AFTER .repeat fix) for scenario " + (i + 1) + ":\n" + cleanedText);
      } catch (repeatError) {
          Logger.log("Error during '.repeat()' replacement: " + repeatError.message);
          continue; // Skip scenario if replacement fails
      }
      // *****************************************************************

      var testCases = null;

      // Attempt to parse the *potentially fixed* text as JSON
      try {
        if (cleanedText === "") throw new Error("Cleaned text is empty");
        testCases = JSON.parse(cleanedText);
        Logger.log("Successfully parsed JSON for scenario " + (i + 1));
      } catch (e) {
        // Fallback if parsing *still* fails
        Logger.log("Error parsing JSON for scenario " + (i + 1) + " even after .repeat fix: " + e.message + ". Attempting manual extraction.");
        testCases = extractTestCases(cleanedText); // Use fallback
        if (testCases && testCases.length > 0) {
             Logger.log("Successfully extracted " + testCases.length + " test cases via Markdown for scenario " + (i + 1));
        } else {
             Logger.log("Markdown extraction failed or yielded no results for scenario " + (i + 1));
             continue; // Skip this scenario if both parsing methods fail
        }
      }

      // --- Validate Parsed/Extracted Data ---
      if (!Array.isArray(testCases)) {
        Logger.log("Data is not an array for scenario " + (i + 1));
        continue;
      }
       if (testCases.length === 0) {
        Logger.log("Data is an empty array for scenario " + (i + 1));
        continue;
      }

      // --- Add Context and Aggregate Results ---
      var validCasesInScenario = 0;
      testCases.forEach(function(testCase) {
          if (typeof testCase === 'object' && testCase !== null) {
             testCase.testScenario = testScenario;
             allTestCases.push(testCase);
             validCasesInScenario++;
          } else {
             Logger.log("Skipping invalid item found in test case array for scenario " + (i+1) + ": " + JSON.stringify(testCase));
          }
      });
      Logger.log("Added " + validCasesInScenario + " valid test cases from scenario " + (i+1));

    } catch (e) {
      // Catch unexpected errors during scenario processing
      Logger.log("Unexpected error processing scenario " + (i + 1) + ": " + e.message + "\nStack: " + e.stack);
      continue; // Skip to the next scenario
    }

    // --- Update Progress Bar in UI ---
    scenariosProcessed++;
    var progress = Math.round((scenariosProcessed / totalScenarios) * 100);
    Logger.log("Progress: " + progress + "% ("+ scenariosProcessed + "/" + totalScenarios + ")");
    try {
      google.script.run.withSuccessHandler(null).updateProgressBar(progress);
      SpreadsheetApp.flush(); // Attempt to force updates
    } catch (uiError) {
      Logger.log("Could not update progress bar: " + uiError.message);
    }

  } // End of loop through scenarios

  // ====================================================================
  // Final Sheet Update
  // ====================================================================
  if (allTestCases.length === 0) {
      Logger.log("Finished processing all scenarios. No test cases were successfully generated or extracted.");
      return "No test cases generated for any provided scenarios. Check execution logs (View > Logs) for details.";
  }

  Logger.log("Generated total " + allTestCases.length + " test cases. Writing to sheet '" + sheet.getName() + "'...");

  // --- Prepare Data for Sheet ---
  var headers = ["Test Case ID", "Test Scenario", "Description", "Test Data", "Expected Result", "Actual Result", "Severity", "Priority"];
  var data = allTestCases.map(function(testCase, index) {
      var testDataString = "N/A";
      try {
         if (typeof testCase.testData === 'object' && testCase.testData !== null) {
            testDataString = JSON.stringify(testCase.testData);
         } else if (testCase.testData !== undefined && testCase.testData !== null) {
            testDataString = String(testCase.testData);
         }
      } catch (stringifyError) {
         Logger.log("Error stringifying testData for TC index " + index + ": " + stringifyError.message);
         testDataString = "{Error stringifying}";
      }
      return [
          testCase.testCaseId || "TC-" + (index + 1),
          testCase.testScenario || "N/A",
          testCase.description || "N/A",
          testDataString,
          testCase.expectedResult || "N/A",
          testCase.actualResult || "",
          testCase.severity || "",
          testCase.priority || ""
      ];
  });

  // --- Write Headers and Data to Sheet ---
  try {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
      Logger.log("Cleared existing content from row 2 to " + lastRow);
    }
    sheet.getRange(2, 1, data.length, headers.length).setValues(data);
    Logger.log("Successfully wrote " + data.length + " rows to sheet.");
    SpreadsheetApp.flush();
  } catch (e) {
      Logger.log("Error writing data to sheet: " + e.message + "\nStack: " + e.stack);
      return "Generated " + allTestCases.length + " test cases, but failed to write to sheet: " + e.message;
  }

  // --- Return Success Message to UI ---
  Logger.log("Script execution completed successfully.");
  return "Successfully generated and added " + allTestCases.length + " test cases to the sheet for " + scenariosProcessed + " processed scenarios!";
}


// ====================================================================
// Helper Function for Fallback Parsing (Markdown)
// ====================================================================

/**
 * Extracts test cases from text assumed to be in a specific Markdown format.
 * Used as a fallback if direct JSON parsing fails. Less reliable than JSON.
 *
 * @param {string} text The text content potentially containing test cases in Markdown.
 * @return {object[]} An array of extracted test case objects, or an empty array if parsing fails.
 */
function extractTestCases(text) {
    if (!text || typeof text !== 'string') {
        Logger.log("extractTestCases: Input text is invalid or empty.");
        return [];
    }
    var lines = text.split("\n");
    var testCases = [];
    var currentTestCase = null;

    lines.forEach(function(line) {
        line = line.trim();
        if (!line) return;

        let idMatch = line.match(/^(?:\*\*|##)\s*Test Case ID\s*[:]?\s*(.*)/i);
        if (idMatch && idMatch[1]) {
            if (currentTestCase) testCases.push(currentTestCase);
            currentTestCase = {
                testCaseId: idMatch[1].trim(), description: "", testData: {},
                expectedResult: "", actualResult: "", severity: "", priority: ""
            };
            Logger.log("Fallback Extractor: Found ID: " + currentTestCase.testCaseId);
            return;
        }
        if (!currentTestCase) return; // Must find ID first

        let titleMatch = line.match(/^(?:\*\*|##)\s*Test (?:Title|Description)\s*[:]?\s*(.*)/i);
        if (titleMatch && titleMatch[1]) {
            currentTestCase.description = titleMatch[1].trim();
            Logger.log("Fallback Extractor: Found Description for " + currentTestCase.testCaseId);
            return;
        }
        let dataMatch = line.match(/^(?:\*\*|##)\s*Test Data\s*[:]?\s*(.*)/i);
        if (dataMatch && dataMatch[1]) {
            let dataString = dataMatch[1].trim();
            try {
                currentTestCase.testData = JSON.parse(dataString);
                Logger.log("Fallback Extractor: Parsed Test Data (JSON) for " + currentTestCase.testCaseId);
            } catch (e) {
                currentTestCase.testData = { rawData: dataString };
                Logger.log("Fallback Extractor: Found Test Data (Raw) for " + currentTestCase.testCaseId);
            }
            return;
        }
        let expectedMatch = line.match(/^(?:\*\*|##)\s*Expected Result\s*[:]?\s*(.*)/i);
        if (expectedMatch && expectedMatch[1]) {
            currentTestCase.expectedResult = expectedMatch[1].trim();
            Logger.log("Fallback Extractor: Found Expected Result for " + currentTestCase.testCaseId);
            return;
        }
        // Basic Pass/Fail or other field detection could be added here if needed
    });
    if (currentTestCase) testCases.push(currentTestCase); // Add the last one
    Logger.log("Fallback Extraction completed. Found " + testCases.length + " potential test cases.");
    return testCases;
}
