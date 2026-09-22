# Cursor agent protocol provenance

`agent.proto` is vendored from oh-my-pi at commit
`1b220a4f65554ffb3a505a5df92a2eebf2d60545`:

<https://github.com/can1357/oh-my-pi/blob/1b220a4f65554ffb3a505a5df92a2eebf2d60545/packages/ai/src/providers/cursor/proto/agent.proto>

The vendored schema is used under the MIT License:

> MIT License
>
> Copyright (c) 2025 Mario Zechner
> Copyright (c) 2025-2026 Can Bölük
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

## Local compatibility declarations

The upstream file is preserved except for exactly three declarations retained
for compatibility with the provider's previous checked-in binding and current
call sites:

- `UserMessage.selected_context_blob = 10`
- `UserMessage.correlation_id = 17`
- `ConversationStateStructure.client_name = 22`

Regenerate `agent_pb.ts` with `npm run proto:generate`. This requires `protoc`
on `PATH`; the repository pins `@bufbuild/protoc-gen-es` to `2.10.2`.
