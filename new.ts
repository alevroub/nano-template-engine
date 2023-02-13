import { Tokenizer } from './src/tokenizer.ts';

type NodeType = NodeIf | NodeElse | NodeFor | NodeTag | NodeText;
type NodeTypeList = NodeType[];

type NodeIf = {
	type: 'If';
	test: any;
	consequent: NodeTypeList;
	alternate: NodeIf | NodeElse | null;
};

type NodeElse = {
	type: 'Else';
	value: NodeTypeList;
};

type NodeFor = {
	type: 'For';
	variables: any;
	iterator: any;
	value: NodeTypeList;
};

type NodeTag = {
	type: 'Tag';
	value: string;
};

type NodeText = {
	type: 'Text';
	value: string;
};

class NanoError extends SyntaxError {
	public name = 'NanoSyntaxError';
}

function ParseExpression(input_expression: string) {
	const expression_tokens: TokenSpec = [
		[/^\s+/, null],
		[/^<!--[\s\S]*?-->/, null],

		[/^\(/, 'L_PARENTHESIS'],
		[/^\)/, 'R_PARENTHESIS'],
		[/^\[/, 'L_BRACKET'],
		[/^\]/, 'R_BRACKET'],
		[/^\{/, 'L_CURLY'],
		[/^\}/, 'R_CURLY'],
		[/^\,/, 'COMMA'],
		[/^\./, 'DOT'],

		[/^\bimport\b/, 'IMPORT'],
		[/^\bwith\b/, 'WITH'],
		[/^\bfor\b/, 'FOR'],
		[/^\bin\b/, 'IN'],
		[/^\bif\b/, 'IF'],
		[/^\belse\b/, 'ELSE'],
		[/^\btrue\b/, 'TRUE'],
		[/^\bfalse\b/, 'FALSE'],
		[/^\bnull\b/, 'NULL'],

		[/^[+\-]/, 'ADDITIVE'],
		[/^[*\/]/, 'MULTIPLICATIVE'],

		[/^[=!]=/, 'EQUALITY'],
		[/^[><]=?/, 'RELATIONAL'],
		[/^&&/, 'AND'],
		[/^\|\|/, 'OR'],
		[/^!/, 'NOT'],

		[/^\d+(\.\d+)?/, 'NUMBER'],
		[/^[A-Za-z0-9_$ß]+/, 'IDENTIFIER'],

		[/^\?/, 'QUESTIONMARK'],
		[/^\:/, 'COLON'],

		[/^"[^"]*"/, 'STRING'],
		[/^'[^']*'/, 'STRING'],
	];
	const tokenizer = Tokenizer(input_expression, expression_tokens);
}

function ParseTemplate(input_template: string) {
	const template_tokens: TokenSpec = [
		[/^<!--[\s\S]*?-->/, null],
		[/^<(style|script)[\s\S]*?>[\s\S]*?<\/(script|style)>/, 'TEXT'],

		[/^{if [\s\S]*?}/, 'IF'],
		[/^{else if [\s\S]*?}/, 'ELSEIF'],
		[/^{else}/, 'ELSE'],
		[/^{\/if}/, 'IF_END'],

		[/^{for [\s\S]*?}/, 'FOR'],
		[/^{\/for}/, 'FOR_END'],

		[/^{[\s\S]*?}/, 'TAG'],
		[/^[\s\S]?/, 'TEXT'],
	];

	const tokenizer = Tokenizer(input_template, template_tokens);

	function Node(token_type: any): NodeType {
		switch (token_type) {
			case 'IF':
				return If();
			case 'ELSEIF':
				return ElseIf();
			case 'ELSE':
				return Else();
			case 'FOR':
				return For();
			case 'TAG':
				return Tag();
			case 'TEXT':
				return Text();
			default:
				return Skip();
		}
	}

	function NodeList(token_type_limit: undefined | string = undefined): NodeTypeList {
		const node_list: NodeTypeList = [];

		while (tokenizer.next() && tokenizer.next().type !== token_type_limit) {
			const next_type = tokenizer.next().type;
			const next_node = Node(next_type);

			node_list.push(next_node);
		}

		return node_list;
	}

	function For(): NodeFor {
		const token = tokenizer.advance('FOR');
		const expression_string = token.value.slice(1, -1);
		const expression_parsed = expression_string;
		const value = NodeList('FOR_END');

		tokenizer.advance('FOR_END');

		return {
			type: 'For',
			variables: expression_string,
			iterator: '',
			value: value,
		};
	}

	function If(token_type: 'IF' | 'ELSEIF' = 'IF'): NodeIf {
		const token = tokenizer.advance(token_type);
		const expression_string = token.value.slice(1, -1);
		const expression_parsed = expression_string;

		let consequent: NodeTypeList = [];
		let alternate: NodeIf | NodeElse | null = null;

		while (tokenizer.next() && tokenizer.next().type !== 'IF_END') {
			const next_type = tokenizer.next().type;
			const next_node = Node(next_type);

			if (next_type === 'ELSEIF') {
				alternate = next_node as NodeIf;
			} else if (next_type === 'ELSE') {
				alternate = next_node as NodeElse;
			} else {
				/**
				 * @TODO handle flags
				 * */

				// if (next_type === 'TEXT') {
				// 	next_node.flags = [true];
				// }

				consequent.push(next_node);
			}
		}

		// try {
		if (token_type === 'IF') {
			tokenizer.advance('IF_END');
		}
		// } catch (error) {
		// 	throw new NanoError(`Missing {/if} closing tag (line ${tokenizer.line()})`);
		// }

		return {
			type: 'If',
			test: expression_parsed,
			consequent: consequent,
			alternate: alternate,
		};
	}

	function ElseIf(): NodeIf {
		return If('ELSEIF');
	}

	function Else(): NodeElse {
		tokenizer.advance('ELSE');

		return {
			type: 'Else',
			value: NodeList('IF_END'),
		};
	}

	function Tag(): NodeTag {
		const token = tokenizer.advance('TAG');
		const expression_string = token.value.slice(1, -1);

		return {
			type: 'Tag',
			value: expression_string,
		};
	}

	function Text(): NodeText {
		const token = tokenizer.advance('TEXT');
		let token_value = token.value;

		while (tokenizer.next() && tokenizer.next().type === 'TEXT') {
			token_value += tokenizer.advance('TEXT').value;
		}

		return {
			type: 'Text',
			value: token_value,
		};
	}

	function Skip(token_type) {
		return tokenizer.advance();
	}

	function Root() {
		return {
			type: 'Root',
			value: NodeList(),
		};
	}

	return Root();
}

try {
	console.dir(
		ParseTemplate(`{ey bla}
			BBBB
			{if ble}
		`),
		{ depth: 100 }
	);
} catch (error) {
	console.log(error);
}
