import { skills } from "services/skills";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const readSkillTool = defineTool(
  "ReadSkill",
  "Read the full content of a skill by its name",
  z.object({
    name: z.string().describe("Name of the skill to read"),
  }),
  async ({ name }) => {
    const skill = await skills.getByName(name);
    if (!skill) return { error: `Skill "${name}" not found` };
    return await skills.readContent(skill.id);
  },
);
