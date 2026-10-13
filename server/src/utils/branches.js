// server/src/utils/branches.js
//
// One branch, many spellings. One batch sheet says "CSE", the next "Computer
// Science & Engg.", and the placement report split one department into
// several rows; an announcement "to Mechanical" reached nobody whose profile
// said "Mechanical Engineering". Both now compare canonical names.
// Two-letter codes that mean different branches at different universities
// ("CE" is Civil at some and Computer Engineering at Mumbai, Pune and Gujarat)
// are deliberately left out: an unknown code stays as typed rather than being
// merged into the wrong department.
const BRANCH_CANON = {
  'Computer Science Engineering': ['cse', 'cs', 'computerscience', 'computerscienceengineering', 'computerengineering', 'coe', 'comp'],
  'Information Technology': ['it', 'informationtechnology'],
  'Electronics and Communication Engineering': ['ece', 'ec', 'electronicscommunication', 'electronicscommunicationengineering', 'electronicstelecommunication', 'electronicstelecommunicationengineering', 'entc', 'extc'],
  'Electrical and Electronics Engineering': ['eee', 'electricalelectronics', 'electricalelectronicsengineering'],
  'Electrical Engineering': ['electrical', 'electricalengineering'],
  'Mechanical Engineering': ['mech', 'mechanical', 'mechanicalengineering'],
  'Civil Engineering': ['civil', 'civilengineering'],
  'Chemical Engineering': ['che', 'chemical', 'chemicalengineering'],
  'Artificial Intelligence and Data Science': ['aids', 'aiandds', 'ads', 'artificialintelligencedatascience'],
  'Artificial Intelligence and Machine Learning': ['aiml', 'artificialintelligencemachinelearning']
};
const BRANCH_ALIASES = Object.entries(BRANCH_CANON).reduce((acc, [label, keys]) => {
  keys.forEach((k) => {
    acc[k] = label;
  });
  return acc;
}, {});
/** Canonical name for a branch as typed in any batch sheet. */
const branchLabel = (branch) => {
  const raw = (branch || '').trim();
  if (!raw) return 'Unspecified';
  const key = raw
    .toLowerCase()
    .replace(/\bengg\b\.?|\bengg\./g, 'engineering')
    .replace(/&|\band\b/g, '')
    .replace(/[^a-z]/g, '');
  return BRANCH_ALIASES[key] || raw;
};

module.exports = { branchLabel, BRANCH_CANON };
