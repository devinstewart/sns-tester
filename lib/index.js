'use strict';

const AWS = require('aws-sdk');
const { Octokit } = require('@octokit/rest');
const Fs = require('fs');
const Globby = require('globby');
const { readFile } = require('fs-extra');
const Path = require('path');

const SSM = new AWS.SSM({ region: 'us-east-1' });

const owner = 'devinstewart';
const repo = 'sns-tester';
const ref = 'heads/main';

const internals = {};

/**
* @returns {Promise<string>} SNS Topic ARN in AWS Parameter Store
*/
const getSnsTopicArn = async () => {

    const { Parameter: { Value: SnsTopicArn } } = await SSM.getParameter({ Name: '/sns/topic-arn/sns-payload-validator-errors', WithDecryption: true }).promise();
    return SnsTopicArn;
};

/**
* @param {string} status String put in status file that is added, committed, and pushed
*/
const pushGithubMessage = async (status) => {

    Fs.writeFileSync('status', status);

    const octo = await internals.createOctokit(await internals.getGitHubToken());
    const currentCommit = await internals.getCurrentCommit(octo);
    const filesPaths = await Globby(Path.join(__dirname, '..'), { gitignore: true });
    const filesBlobs = await Promise.all(filesPaths.map((fullPath) => internals.createBlobForFile(octo, fullPath)));
    const pathsForBlobs = filesPaths.map((fullPath) => Path.relative(`../${repo}`, fullPath));
    const currentTree = await internals.createCurrentTree(octo, filesBlobs, pathsForBlobs, currentCommit.treeSha);
    const newCommit = await internals.createNewCommit(octo, currentTree.sha, currentCommit.commitSha);
    await internals.setBranchToCommit(octo, newCommit.sha);
};

/**
* @returns {Promise<string>} GitHub token in AWS Parameter Store
*/
internals.getGitHubToken = async () => {

    const { Parameter: { Value: gitHubToken } } = await SSM.getParameter({ Name: '/github/token', WithDecryption: true }).promise();
    return gitHubToken;
};

/**
* @param {string} gitHubToken token received from internals.getGitHubToken()
* @returns {Promise<Octokit>} GitHub API client
*/
internals.createOctokit = (gitHubToken) => {

    const octo = new Octokit({
        auth: gitHubToken
    });

    return octo;
};

/**
 * @param {Octokit} octo GitHub API client returned from internals.createOctokit()
 */
internals.getCurrentCommit = async (octo) => {

    const { data: refData } = await octo.rest.git.getRef({ owner, repo, ref });
    const commitSha = refData.object.sha;
    const { data: commitData } = await octo.rest.git.getCommit({ owner, repo, commit_sha: commitSha });
    return { commitSha, treeSha: commitData.tree.sha };
};

/**
 * @param {string} fullPath path to file
*/
internals.getFileAsUTF8 = (fullPath) => readFile(fullPath, 'utf8');

/**
 * @param {Octokit} octo GitHub API client returned from internals.createOctokit()
 * @param {string} fullPath path to file
*/
internals.createBlobForFile = async (octo, fullPath) => {

    const content = await internals.getFileAsUTF8(fullPath);
    const blobData = await octo.rest.git.createBlob({ owner, repo, content, encoding: 'utf-8' });
    return blobData.data;
};

/**
 * @param {Octokit} octo GitHub API client returned from internals.createOctokit()
 * @param {{url: string, sha: string}[]} filesBlobs array of objects returned from internals.createBlobForFile()
 * @param {string[]} pathsForBlobs array of paths to add to tree
 * @param {string} treeSha SHA of tree to add to
*/
internals.createCurrentTree = async (octo, filesBlobs, pathsForBlobs, treeSha) => {

    const tree = filesBlobs.map(({ sha }, index) => ({ path: pathsForBlobs[index], mode: '100644', type: 'blob', sha }));
    const { data } = await octo.rest.git.createTree({ owner, repo, tree, base_tree: treeSha });
    return data;
};

/**
 * @param {Octokit} octo GitHub API client returned from internals.createOctokit()
 * @param {string} currentTreeSha SHA of tree from internals.createNewTree()
 * @param {string} currentCommitSha SHA of commit from internals.getCurrentCommit()
*/
internals.createNewCommit = async (octo, currentTreeSha, currentCommitSha) => {

    const date = new Date().toISOString();
    const message = `${date} - Update status file`;
    const  { data }  = await octo.rest.git.createCommit({ owner, repo, message, tree: currentTreeSha, parents: [currentCommitSha] });
    return data;
};

/**
 * @param {Octokit} octo GitHub API client returned from internals.createOctokit()
 * @param {string} commitSha SHA from internals.createNewCommit()
*/
internals.setBranchToCommit = async (octo, commitSha) => {

    await octo.rest.git.updateRef({ owner, repo, ref, sha: commitSha });
};

module.exports = {
    getSnsTopicArn,
    pushGithubMessage
};
