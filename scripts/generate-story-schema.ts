import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { storyDocumentSchema } from '../lib/story-schema';

writeFileSync(join(process.cwd(), 'content', 'story.schema.json'), JSON.stringify(z.toJSONSchema(storyDocumentSchema, { target: 'draft-07' }), null, 2) + '\n');
