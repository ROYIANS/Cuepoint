# Additional owner-context blocker

P2 confirmed through actual production CLI: named function-expression callbacks bypass call-site context due to early FunctionExpression:name return. Reviewed throw moves between differently labeled sibling calls, signature retained, CLI exit0 instead of1. No product edits. Full details in early-named-callback-finding.json; cases27–29. Prior residuals are repaired in independent checks.
