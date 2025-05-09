
function jobArrived(s, job) {
    var rulesText = s.getPropertyValue('Rules');
    var separator = s.getPropertyValue('Separator') || '|';
    var flowElementName = job.getFlowElementName();
    var debugMode = flowElementName.toLowerCase().startsWith('debug_');

    var logger = {
        info: function(msg) { if (debugMode) s.log(2, msg); },
        warn: function(msg) { s.log(3, msg); },
        error: function(msg) { s.log(4, msg); }
    };

    if (debugMode) {
        logger.info('Debug mode enabled.');
    }

    try {
        var rules = parseRules(rulesText, separator, logger);
        applyRules(job, rules, separator, logger);
    } catch (e) {
        logger.error('MetaCrafter failed: ' + e.message);
    }

    return job;
}

function parseRules(rulesText, separator, logger) {
    var lines = rulesText.split(/\r?\n/);
    var rules = [];
    var currentRule = null;

    lines.forEach(function(line, index) {
        var trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('//')) return;

        if (trimmed.startsWith('***')) {
            var headerParts = trimmed.substring(3).trim().split('=').map(function(p) { return p.trim(); });
            var sources = headerParts[0].split(separator).map(function(p) { return p.trim(); });
            var targets = (headerParts[1] || headerParts[0]).split(separator).map(function(p) { return p.trim(); });
            currentRule = { sources: sources, targets: targets, mappings: [] };
            rules.push(currentRule);
            logger.info && logger.info('Parsed rule header: ' + line);
        } else if (currentRule) {
            var parts = line.split('=').map(function(p) { return p.trim(); });
            currentRule.mappings.push({ source: parts[0], target: parts[1] || '' });
        } else {
            throw new Error('Mapping line found without header at line ' + (index + 1));
        }
    });

    return rules;
}

function applyRules(job, rules, separator, logger) {
    rules.forEach(function(rule) {
        var sourceValues = rule.sources.map(f => job.getPrivateDataValue(f) || '');
        var sourceKey = sourceValues.join(separator);
        logger.info && logger.info('Checking rule: ' + rule.sources.join(', ') + ' = "' + sourceKey + '"');
        for (var i = 0; i < rule.mappings.length; i++) {
            var m = rule.mappings[i];
            var type = 'EXACT', pattern = m.source;
            if (m.source.startsWith('REGEX ')) { type = 'REGEX'; pattern = m.source.slice(6).trim(); }
            else if (m.source.startsWith('NUMERIC ')) { type = 'NUMERIC'; pattern = m.source.slice(8).trim(); }
            else if (m.source === '') type = 'EMPTY';
            else if (m.source === '.') type = 'DEFAULT';

            if (matchSource(type, pattern, sourceKey, logger)) {
                var values = processTarget(m.target, sourceKey, type, pattern, logger);
                if (rule.targets.length !== values.length)
                    throw new Error('Target fields do not match values.');
                for (var j = 0; j < rule.targets.length; j++) {
                    job.setPrivateData(rule.targets[j], values[j]);
                    logger.info && logger.info('Set ' + rule.targets[j] + ' = "' + values[j] + '"');
                }
                return;
            }
        }
    });
}

function matchSource(type, pattern, sourceKey, logger) {
    try {
        if (type === 'EXACT') return sourceKey === pattern;
        if (type === 'EMPTY') return sourceKey === '';
        if (type === 'DEFAULT') return true;
        if (type === 'NUMERIC') {
            var val = parseFloat(sourceKey);
            if (isNaN(val)) return false;
            if (pattern.startsWith('>=')) return val >= parseFloat(pattern.slice(2));
            if (pattern.startsWith('<=')) return val <= parseFloat(pattern.slice(2));
            if (pattern.startsWith('>')) return val > parseFloat(pattern.slice(1));
            if (pattern.startsWith('<')) return val < parseFloat(pattern.slice(1));
            if (pattern.startsWith('==')) return val === parseFloat(pattern.slice(2));
        }
        if (type === 'REGEX') return new RegExp(pattern).test(sourceKey);
    } catch (e) {
        logger.error && logger.error('Matching failed: ' + e.message);
        return false;
    }
    return false;
}

function processTarget(text, sourceKey, type, pattern, logger) {
    if (type === 'REGEX') {
        try {
            var match = new RegExp(pattern).exec(sourceKey);
            if (!match) return text.split('|').map(t => t.trim());
            if (text.includes('$')) {
                return text.replace(/\$(\d+)/g, (_, i) => match[i] || '').split('|').map(t => t.trim());
            } else {
                logger.warn && logger.warn('No $1 in REGEX target; using full match.');
                return [match[0]];
            }
        } catch (e) {
            logger.error && logger.error('Regex substitution error: ' + e.message);
            return [text];
        }
    }
    return text.split('|').map(t => t.trim());
}
