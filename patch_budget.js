const fs = require('fs');

let content = fs.readFileSync('app/_pages/Budget.tsx', 'utf8');

content = content.replace('import { getActiveBudget, createBudget, getBudgetHistory, deleteBudget } from "@/lib/api/budget";', 'import { getBudgetStatus, getBudgetHistory } from "@/lib/api/budget";');

// Rip out createBudgetMutation, handleCreateBudget, handleDeleteBudget
content = content.replace(/const createBudgetMutation = useMutation\(\{[\s\S]*?\}\);/m, '');
content = content.replace(/const handleCreateBudget = \(e: React\.FormEvent\) => \{[\s\S]*?\};/m, '');
content = content.replace(/const handleDeleteBudget = async \(id: string\) => \{[\s\S]*?\};/m, '');

// Fix getActiveBudget call
content = content.replace("queryFn: () => getActiveBudget(user!.id)", "queryFn: () => getBudgetStatus(user!.id)");

// Strip out the create modal UI
content = content.replace(/\{showCreateModal && \([\s\S]*?\}\)/m, '');
// Strip out the delete button
content = content.replace(/<button[\s\S]*?onClick=\{[\s\S]*?handleDeleteBudget[\s\S]*?\}[\s\S]*?<\/button>/m, '');
// Strip out the create budget button in header
content = content.replace(/<button[\s\S]*?onClick=\{[\s\S]*?setShowCreateModal\(true\)[\s\S]*?\}[\s\S]*?<\/button>/m, '<div className="w-6" />');
// Strip out default amount effect
content = content.replace(/useEffect\(\(\) => \{[\s\S]*?if \(!activeBudget\) \{[\s\S]*?\}[\s\S]*?\}, \[currencySymbol, activeBudget\]\);/m, '');
// Strip showCreateModal and newBudget states
content = content.replace(/const \[showCreateModal[\s\S]*?\] = useState\(false\);/m, '');
content = content.replace(/const \[newBudget, setNewBudget\] = useState\(\{[\s\S]*?\}\);/m, '');
// Strip getDynamicDailyBudget import
content = content.replace(/import \{ getDynamicDailyBudget \} from "@\/lib\/services\/BudgetEngine";/m, '');

fs.writeFileSync('app/_pages/Budget.tsx', content);
console.log('Success');
