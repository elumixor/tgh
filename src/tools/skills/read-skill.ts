import { skills } from "services/skills";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const readSkillTool = defineTool(
  "ReadSkill",
  "Read the full content of a skill by its CamelCase name.",
  z.object({
    name: z.string().describe("CamelCase name of the skill to read"),
  }),
  async ({ name }) => {
    const skill = skills.getByName(name);
    if (!skill) return { error: `Skill "${name}" not found` };

    const content = await skills.readContent(skill.id);
    return { name: skill.name, description: skill.description, content };
  },
);
