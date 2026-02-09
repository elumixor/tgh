import { skills } from "services/skills";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const addSkillTool = defineTool(
  "AddSkill",
  "Create a new skill with a name, description, and markdown content.",
  z.object({
    name: z.string().describe("Human-readable skill name (e.g. 'My Skill Name')"),
    description: z.string().describe("Short description of what the skill does"),
    content: z.string().describe("Full skill content in markdown format"),
  }),
  async ({ name, description, content }) => {
    const created = await skills.add(name, description, content);
    return { success: true, skill: created };
  },
);
