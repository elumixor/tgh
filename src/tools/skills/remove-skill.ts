import { skills } from "services/skills";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const removeSkillTool = defineTool(
  "RemoveSkill",
  "Remove a skill by its CamelCase name.",
  z.object({
    name: z.string().describe("CamelCase name of the skill to remove"),
  }),
  async ({ name }) => {
    const skill = await skills.getByName(name);
    if (!skill) return { error: `Skill "${name}" not found` };

    await skills.remove(skill.id);
    return { success: true, removed: name };
  },
);
