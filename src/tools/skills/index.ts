import { addSkillTool } from "./add-skill";
import { readSkillTool } from "./read-skill";
import { removeSkillTool } from "./remove-skill";
import { updateSkillTool } from "./update-skill";

export { addSkillTool, readSkillTool, removeSkillTool, updateSkillTool };

export const skillTools = [readSkillTool, addSkillTool, removeSkillTool, updateSkillTool];
