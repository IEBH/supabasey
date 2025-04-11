import RulesMFDC from '@momsfriendlydevco/eslint-config';

export default [
	{
		// Global ignore rules - Do not add any other keys to this object
		ignores: [
			'.*',
			'dist/',
			'node_modules/',
		],
	},
	...RulesMFDC,
]
