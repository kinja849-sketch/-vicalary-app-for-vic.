/**
 * scripts/check_coderabbit.js
 * Script to automatically fetch CodeRabbit reviews, comments, and AI prompts from GitHub API.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const REPO_OWNER = process.env.REPO_OWNER || 'kinja849-sketch';
const REPO_NAME = process.env.REPO_NAME || '-vicalary-app-for-vic.';

async function fetchCodeRabbitReviews() {
  console.log(`Checking CodeRabbit reviews for ${REPO_OWNER}/${REPO_NAME}...`);

  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    'User-Agent': 'Node-CodeRabbit-Checker',
    Accept: 'application/vnd.github.v3+json',
  };

  try {
    // 1. Fetch Pull Requests
    const prsRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=all`, { headers });
    const prs = await prsRes.json();

    if (!Array.isArray(prs) || prs.length === 0) {
      console.log('No Pull Requests found.');
      return;
    }

    console.log(`Found ${prs.length} Pull Requests.`);

    for (const pr of prs) {
      console.log(`\n========================================`);
      console.log(`PR #${pr.number}: ${pr.title} (${pr.state})`);
      console.log(`URL: ${pr.html_url}`);
      console.log(`========================================`);

      // 2. Fetch Review Comments on PR
      const reviewCommentsRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pr.number}/comments`, { headers });
      const reviewComments = await reviewCommentsRes.json();

      // 3. Fetch Issue Comments on PR
      const issueCommentsRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${pr.number}/comments`, { headers });
      const issueComments = await issueCommentsRes.json();

      const allComments = [
        ...(Array.isArray(reviewComments) ? reviewComments : []),
        ...(Array.isArray(issueComments) ? issueComments : []),
      ];

      const codeRabbitComments = allComments.filter(
        (c) => c.user && (c.user.login.includes('coderabbit') || c.body.includes('CodeRabbit'))
      );

      if (codeRabbitComments.length === 0) {
        console.log(`No CodeRabbit comments found on PR #${pr.number}.`);
      } else {
        console.log(`Found ${codeRabbitComments.length} CodeRabbit comments/reviews:\n`);
        codeRabbitComments.forEach((comment, index) => {
          console.log(`--- [Comment ${index + 1}] by @${comment.user.login} ---`);
          console.log(comment.body);
          console.log(`----------------------------------------\n`);
        });
      }
    }
  } catch (error) {
    console.error('Error fetching CodeRabbit reviews:', error);
  }
}

fetchCodeRabbitReviews();
