# Collecting survey answers

1. Sign in to the host desk and choose **Surveys**.
2. Give the survey a title and select Regular rounds or Fast Money.
3. Select 5–30 questions from a pack, or enter your own questions one per line.
   Custom text replaces the preset selection. Respondents never see pack answers.
4. Create the survey and share its response link or QR code. No name, email or
   host password is required to respond. People may skip questions.
5. Refresh results to see progress. Aim for 100 respondents, but smaller samples
   can be exported with their true sample size disclosed.
6. Close collection before review. Assign equivalent wordings the same group
   label. Case and whitespace are grouped automatically; spelling and meaning
   need human judgment. Review each question, then save grouping and review.
7. Download the question-bank JSON or save the bank directly to the question
   library. Download saved response counts separately to retain the evidence.

Scores are percentages of nonblank answers to each question. Largest-remainder
rounding makes all groups total 100 before the top eight positive groups are
selected for the game. For example, three Rice answers and one Beans answer give
75 and 25 points. A skipped question does not reduce scores on that question.
Counts, skipped totals and sample-size wording are retained. This is a convenience
sample, not a representative population survey or an assertion that 100 people
were interviewed. Review every question; at least two answer groups per question
are needed for the game bank. Fast Money game setup separately checks reachability
of the 200-point target.

Questions are fixed once the form is created. Reopening collection clears review
approvals. Concurrent response/review changes require a refresh before saving.
The server rejects unreviewed exports. Export also saves current review edits so
it cannot silently use older grouping decisions.

Responses and group decisions are stored in the app's persistent SQLite database.
The public form reveals only the questions and submission status. The host alone
can view results and export. Each browser gets a survey-specific cookie to prevent
accidental repeat submissions; clearing cookies, using another browser or changing
domains can bypass this courtesy check. It is not identity verification. Share
one consistent link. There is a limit of 2,000 submissions per survey.
