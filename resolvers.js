const db = require('./db')
const fetch = require('node-fetch');
let base64 = require('base-64');
const stringutils = require('./utils/stringutils');
const {azureDetails} = require('./azure/constants');
const {updateTestStepResults} = require('./azure/ops')

PAT =  azureDetails.pat;   //"loevmhn2cmsjfqreootm7zb3bo7q6xoteoxs3xxygywwht53zkya"; //PAT - Personal Access Token
BASE_URL = azureDetails.url;

CREATE_TEST_RUN_URL = `${BASE_URL}{0}/_apis/test/runs?{1}`;
GET_OR_UPDATE_TEST_RUN_URL = `${BASE_URL}{0}/_apis/test/runs/{1}?{2}`;
ADD_OR_UPDATE_TESTCASE_RESULT_URL = `${BASE_URL}{0}/_apis/test/runs/{1}/results?{2}`;
GET_WIT_BY_ID_URL = `${BASE_URL}{0}/_apis/wit/workitems/{1}?{2}`;
GET_POINTS_BY_TESTCASE_ID_URL = `${BASE_URL}{0}/_apis/test/Plans/{1}/Suites/{2}/points?testCaseId={3}&{4}`;
GET_TESTCASES_BY_SUITE_URL = `${BASE_URL}{0}/_apis/testplan/plans/{1}/suites/{2}/testcase?configurationIds={3}&api-version=5.1-preview.2`;
GET_TESTCASE_BY_ID_AND_SUITE_URL = `${BASE_URL}{0}/_apis/testplan/plans/{1}/suites/{2}/testcase/{3}?configurationIds={3}&api-version=5.1-preview.2`;
GET_CONFIGURATIONS_BY_TESTPLAN_URL = `${BASE_URL}{0}/_apis/testplan/configurations?api-version=5.1-preview.1`;
UPDATE_TESTPOINT_TO_RESET_URL = `${BASE_URL}{0}/_apis/testplan/Plans/{1}/Suites/{2}/TestPoint?api-version=5.1-preview.2`;

const Query = {
  test: () => 'Test Success, GraphQL server is up & running !!',
  students: () => { return db.students.list() },
  studentById: (root, args) => { return db.students.get(args.id) }
}

const Mutation = {
  createStudent: (root, args) => {
    const id = db.students.create({
      collegeId: args.collegeId,
      firstName: args.firstName,
      lastName: args.lastName
    });
    return db.students.get(id);
  },

  signUp: () => {
    return "Sucess";
  },

  createATestRun: async (root, args) => {
    try {
      const project = args.projectInput;
      const input = args.input;
      let headers = getHeaders();
      url = stringutils.format(CREATE_TEST_RUN_URL, project.projectName, project.apiVersion);
      console.log(url);
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(input)
      });
      const json = await response.json();
      console.log(json);
      return json;
    } catch (err) {
      console.log(err);
    }
  },

  updateTestRun: async (root, args) => {
    try {
      const input = args.state;
      const project = args.projectInput
      let headers = getHeaders();
      let url = stringutils.format(GET_OR_UPDATE_TEST_RUN_URL, project.projectName, project.runId, project.apiVersion);
      console.log(url);
      const response = await fetch(url, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify(input)
      });

      const json = await response.json();
      console.log(json);
      return json;
    } catch (err) {
      console.log(err);
    }
  },

  addATestCaseResultToRun: async (root, args) => {
    let project = args.projectInput;
    // let testcaseDetails = await getTestCaseByID(project, args.testCaseId);
    let testcaseDetails = await getTestCaseDetailsById(project, args.testCaseId);
    let url = stringutils.format(ADD_OR_UPDATE_TESTCASE_RESULT_URL, project.projectName, project.runId, project.apiVersion);
    console.log(url);
    console.log(JSON.stringify([testcaseDetails]));
    try {
      const response = await fetch(url,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify([testcaseDetails])
        });

      const data = await response.json();
      console.log(data.value[0]);
      return data.value[0];
    }
    catch (err) {
      console.log(err);
    }
  },

  updateTestCaseResult: async (root, args) => {
    let project = args.projectInput;
    let testInput = args.input;
    let testCaseId = args.testCaseId;

    await updateTestStepResults(project.projectName, project.runId, testCaseId, testInput.id, 1);
    
    let url = stringutils.format(ADD_OR_UPDATE_TESTCASE_RESULT_URL, project.projectName, project.runId, project.apiVersion);
    console.log(url);    
    testInputJSON = JSON.stringify([testInput]);
    console.log(testInputJSON);
    const response = await fetch(url, {
      method: "PATCH",
      headers: getHeaders(),
      body: testInputJSON
    });
    const data = await response.json();
    console.log(data.value[0]);
    return data.value[0];
  },

  resetTestCasesToActive: async (root, args) => {
    let project = args.projectInput;
    let testPoints = await getTestPointsByConfiguration(project);
    let jsonPoints = JSON.stringify(testPoints);
    console.log(jsonPoints);

    let url = stringutils.format(UPDATE_TESTPOINT_TO_RESET_URL, 
      project.projectName,
      project.planID,
      project.suiteID
      )

    console.log(url);

    const response = await fetch(url, {
      method: "PATCH",
      headers: getHeaders(),
      body: jsonPoints
    });

    const data = await response.json();
    console.log(data);
    return data.value;
  }
}

async function getTestCaseDetailsById(projectInfo, testCaseId){
  let configurationId = await getConfigurationIdByName(projectInfo.projectName, projectInfo.configurationName);
  
  let url = stringutils.format(GET_TESTCASE_BY_ID_AND_SUITE_URL,
    projectInfo.projectName, projectInfo.planID, projectInfo.suiteID, testCaseId, configurationId);

  console.log(url);

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders()
  });

  const data = await response.json();
  console.log(data.value);
  testcaseDetails = getTestCaseData(data.value[0]);
  return testcaseDetails;
}

async function getTestCaseByID(projectInfo, testCaseId) {
  url = stringutils.format(GET_WIT_BY_ID_URL, projectInfo.projectName, testCaseId, projectInfo.apiVersion);
  console.log(url)
  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders()
  });
  const data = await response.json();

  let testcaseDetails = getTestCaseDetails(data);
  const pointData = await getPointData(projectInfo, testCaseId);
  testcaseDetails.testPoint.id = pointData.value[0].id;
  console.log(testcaseDetails);
  return testcaseDetails;
}

function getTestCaseData(data) {
  console.log(data);
  testcaseDetails = { testCase: {}, testPoint: {} }
  let workitem = data.workItem;
  testcaseDetails.testCase.id = workitem.id;
  testcaseDetails.testCaseTitle = testcaseDetails.automatedTestName = workitem.name;
  testcaseDetails.state = "InProgress";
  testcaseDetails.outcome = "InProgress";
  testcaseDetails.testCaseRevision = workitem.workItemFields.find(x=> x.hasOwnProperty("System.Rev"))["System.Rev"];
  testcaseDetails.testPoint.id = data.pointAssignments[0].id;
  return testcaseDetails;
}

function getTestCaseDetails(data) {
  console.log(data);
  testcaseDetails = { testCase: {}, testPoint: {} }
  testcaseDetails.testCase.id = data.id;
  testcaseDetails.testCaseTitle = testcaseDetails.automatedTestName = data.fields["System.Title"];
  testcaseDetails.state = "InProgress";
  testcaseDetails.outcome = "InProgress";
  testcaseDetails.testCaseRevision = data.rev;
  return testcaseDetails;
}

async function getPointData(projectInfo, testCaseId) {
  url = stringutils.format(GET_POINTS_BY_TESTCASE_ID_URL,
    projectInfo.projectName,
    projectInfo.planID,
    projectInfo.suiteID,
    testCaseId,
    projectInfo.apiVersion
  );

  console.log(url);
  const response = await fetch(url,
    {
      method: "GET",
      headers: getHeaders()
    });
  const data = await response.json();
  console.log(data);
  return data;
}

async function getTestPointsByConfiguration(projectInfo) {

  let configurationId = await getConfigurationIdByName(projectInfo.projectName, projectInfo.configurationName);

  let url = stringutils.format(GET_TESTCASES_BY_SUITE_URL,
    projectInfo.projectName, projectInfo.planID, projectInfo.suiteID, configurationId);

  console.log(url);

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders()
  });

  const data = await response.json();
  console.log(data);

  let points = [];
  for (let tc of data.value) {
    let pointId = tc.pointAssignments.find(x => x.configurationId == configurationId).id;
    points.push({ "id": pointId, "isActive": true });
  }
  console.log(points);
  return points;
}

async function getConfigurationIdByName(projectName, configurationName) {
  let url = stringutils.format(GET_CONFIGURATIONS_BY_TESTPLAN_URL, projectName);
  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders()
  });

  const data = await response.json();
  console.log(data);

  let configurationId = data.value.find(config => config.name == configurationName).id;
  console.log(configurationId);

  return configurationId;
}

function getHeaders() {
  let headers = new fetch.Headers();
  headers.append('Authorization', 'Basic ' + base64.encode(":"+ PAT));
  headers.append('Content-Type', 'application/json');
  return headers;
}

module.exports = { Query, Mutation }