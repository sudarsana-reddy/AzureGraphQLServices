const azdev = require("azure-devops-node-api");
const tm = require("azure-devops-node-api/TestApi");
const WorkItemExpand = require('azure-devops-node-api/interfaces/WorkItemTrackingInterfaces');
const { ResultDetails } = require('azure-devops-node-api/interfaces/TestInterfaces');
const parser = require('xml-js');
const {azureDetails} = require('./constants');


let orgUrl = azureDetails.url;
let token = azureDetails.pat;
let authHandler = azdev.getPersonalAccessTokenHandler(token);
let connection = new azdev.WebApi(orgUrl, authHandler);

async function updateTestStepResults(projectName, runId, testCaseId, resultId, iterationId) {
    let testAPI = await connection.getTestApi();
    let witAPI = await connection.getWorkItemTrackingApi();
    
    let testCaseObject = await witAPI.getWorkItem(testCaseId,
        null,
        null,
        WorkItemExpand.All);

    let steps = testCaseObject.fields["Microsoft.VSTS.TCM.Steps"];    

    let json = parser.xml2json(steps, { compact: true, spaces: 4 });
    let actions = JSON.parse(json).steps.step;
    console.log(actions);

    let testCaseResult = await testAPI.getTestResultById(projectName,
        runId, resultId, ResultDetails.Iterations);

    console.log(testCaseResult);

    let actionResults = [];

    actions.forEach(step => {
        let action = {};
        action.outcome = "Passed";
        action.iterationId = iterationId;
        action.actionPath = "0000000" + step._attributes.id;
        actionResults.push(action);
    });

    let iteration = {};
    iteration.id = iterationId;
    iteration.actionResults = actionResults;
    iteration.outcome = "Passed";

    testCaseResult.iterationDetails = [];
    testCaseResult.iterationDetails.push(iteration);

    let testCaseResults = await testAPI.updateTestResults([testCaseResult],
        projectName, runId);

    console.log(testCaseResults[0]);
}

module.exports = { updateTestStepResults };